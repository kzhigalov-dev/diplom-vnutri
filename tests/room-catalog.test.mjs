import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRoomsApp} from '../server/rooms/app.mjs';
import {
  catalogPhotoReference,
  catalogSummary,
  catalogTitle,
  fetchRoomCatalog,
  saveRoomCounts,
} from '../public/js/room-catalog.js';

function createMockPool(seed) {
  const store = new Map(seed.map((row) => [row.id, {...row}]));
  const format = (row) => ({
    id: row.id,
    buildingId: row.building_id,
    number: row.number,
    spaceId: row.space_id,
    purposes: row.purposes,
    capacity: row.capacity,
    computerCount: row.computer_count,
    computerCountSource: row.computer_count !== null ? (row.computer_count_source ?? 'manual') : null,
  });

  return {
    async query(sql, params = []) {
      if (sql.includes('WHERE building_id = $1')) {
        const rows = [...store.values()]
          .filter((row) => row.building_id === params[0])
          .sort((a, b) => a.number.localeCompare(b.number, 'ru'))
          .map(format);
        return {rows};
      }
      if (sql.includes('FROM campus.rooms WHERE id = $1')) {
        const row = store.get(params[0]);
        return {rows: row ? [format(row)] : []};
      }
      if (sql.includes('UPDATE campus.rooms')) {
        const [id, capacity, computerCount, prevCapacity, prevComputerCount] = params;
        const row = store.get(id);
        if (!row || row.capacity !== prevCapacity || row.computer_count !== prevComputerCount) {
          return {rows: []};
        }
        if (computerCount === null || computerCount !== row.computer_count) {
          row.computer_count_source = null;
        }
        row.capacity = capacity;
        row.computer_count = computerCount;
        return {rows: [format(row)]};
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test('rooms Fastify API serves inventory, validates payloads, enforces origin/host, and detects conflicts', async () => {
  const idA = '11111111-1111-4111-8111-111111111111';
  const idMissing = '22222222-2222-4222-8222-222222222222';
  const pool = createMockPool([
    {
      id: idA,
      building_id: 'voznesensky',
      number: '478',
      space_id: 'f4-s10',
      purposes: ['computer', 'laboratory'],
      capacity: 25,
      computer_count: 15,
      computer_count_source: 'inventory',
    },
  ]);

  const app = await createRoomsApp({pool, publicRoot: null});
  const baseUrl = await app.listen({port: 0, host: '127.0.0.1'});

  try {
    const listRes = await fetch(`${baseUrl}/api/v1/rooms?buildingId=voznesensky`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.headers.get('cache-control'), 'private, no-store');
    assert.equal(listRes.headers.get('cross-origin-resource-policy'), 'same-origin');
    const list = await listRes.json();
    assert.equal(list.rooms.length, 1);
    assert.equal(list.rooms[0].number, '478');

    const badUuid = await fetch(`${baseUrl}/api/v1/rooms/not-a-uuid`);
    assert.equal(badUuid.status, 400);

    const notFound = await fetch(`${baseUrl}/api/v1/rooms/${idMissing}`);
    assert.equal(notFound.status, 404);

    // Reject cross-site fetch metadata and mismatched origin on PATCH.
    const crossSite = await fetch(`${baseUrl}/api/v1/rooms`, {
      headers: {'sec-fetch-site': 'cross-site'},
    });
    assert.equal(crossSite.status, 403);

    const badOrigin = await fetch(`${baseUrl}/api/v1/rooms/${idA}`, {
      method: 'PATCH',
      headers: {'content-type': 'application/json', origin: 'https://evil.example'},
      body: JSON.stringify({before: {capacity: 25, computerCount: 15}, after: {capacity: 26, computerCount: 16}}),
    });
    assert.equal(badOrigin.status, 403);

    // Reject coerced strings or out-of-range counts.
    const badType = await fetch(`${baseUrl}/api/v1/rooms/${idA}`, {
      method: 'PATCH',
      headers: {'content-type': 'application/json', origin: baseUrl},
      body: JSON.stringify({before: {capacity: 25, computerCount: 15}, after: {capacity: '26', computerCount: 16}}),
    });
    assert.equal(badType.status, 400);

    // Valid update transitions computerCountSource to manual.
    const patchOk = await fetch(`${baseUrl}/api/v1/rooms/${idA}`, {
      method: 'PATCH',
      headers: {'content-type': 'application/json', origin: baseUrl},
      body: JSON.stringify({before: {capacity: 25, computerCount: 15}, after: {capacity: 28, computerCount: 18}}),
    });
    assert.equal(patchOk.status, 200);
    const updated = await patchOk.json();
    assert.equal(updated.capacity, 28);
    assert.equal(updated.computerCount, 18);
    assert.equal(updated.computerCountSource, 'manual');

    // Stale `before` triggers 409 Conflict with current server state.
    const conflict = await fetch(`${baseUrl}/api/v1/rooms/${idA}`, {
      method: 'PATCH',
      headers: {'content-type': 'application/json', origin: baseUrl},
      body: JSON.stringify({before: {capacity: 25, computerCount: 15}, after: {capacity: 30, computerCount: 20}}),
    });
    assert.equal(conflict.status, 409);
    const conflictBody = await conflict.json();
    assert.equal(conflictBody.error, 'room_changed');
    assert.equal(conflictBody.room.capacity, 28);

    // Idempotent retry matching current `after` returns 200.
    const idempotent = await fetch(`${baseUrl}/api/v1/rooms/${idA}`, {
      method: 'PATCH',
      headers: {'content-type': 'application/json', origin: baseUrl},
      body: JSON.stringify({before: {capacity: 25, computerCount: 15}, after: {capacity: 28, computerCount: 18}}),
    });
    assert.equal(idempotent.status, 200);

    // Reject non-loopback Host header.
    const {port} = app.server.address();
    const hostStatus = await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/api/v1/rooms',
        headers: {Host: 'example.com:80'},
      }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(hostStatus, 403);
  } finally {
    await app.close();
  }
});

test('room-catalog helpers format metadata and handle fetch responses cleanly', async () => {
  assert.equal(catalogTitle({purposes: ['computer', 'laboratory']}), 'Компьютерный класс · Лаборатория');
  assert.equal(catalogSummary({capacity: null, computerCount: null}), 'Вместимость не указана. Количество компьютеров не указано.');
  assert.equal(
    catalogSummary({capacity: 24, computerCount: 8, computerCountSource: 'estimate'}),
    'Мест: 24. Компьютеров: 8 (оценка для модели).',
  );
  assert.ok(catalogPhotoReference({buildingId: 'voznesensky', number: '478'})?.computersAlongWalls);
  assert.equal(catalogPhotoReference({buildingId: 'morskaya', number: '478'}), undefined);

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html>404</html>', {
      status: 200,
      headers: {'content-type': 'text/html'},
    });
    assert.equal(await fetchRoomCatalog(), null);

    globalThis.fetch = async () => new Response(JSON.stringify({room: {id: 'r1', capacity: 12}}), {
      status: 409,
      headers: {'content-type': 'application/json'},
    });
    const conflict = await saveRoomCounts({id: 'r1', capacity: 10, computerCount: 5}, {capacity: 11, computerCount: 5});
    assert.deepEqual(conflict, {conflict: {id: 'r1', capacity: 12}});
  } finally {
    globalThis.fetch = originalFetch;
  }
});
