import {fileURLToPath} from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import {openRoomsDatabase} from './db.mjs';

const app = Fastify({
  ajv: {customOptions: {coerceTypes: false, removeAdditional: false}},
});
const pool = openRoomsDatabase();
pool.on('error', () => console.error('PostgreSQL connection lost.'));
app.addHook('onClose', () => pool.end());

const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
await app.register(fastifyStatic, {
  root: publicRoot,
  index: ['index.html'],
  redirect: false,
  dotfiles: 'deny',
  cacheControl: false,
});

const roomFields = `id, building_id AS "buildingId", number, space_id AS "spaceId",
  purposes, capacity, computer_count AS "computerCount",
  CASE WHEN computer_count IS NOT NULL THEN COALESCE(computer_count_source, 'manual') END AS "computerCountSource"`;
const roomId = {type: 'object', required: ['id'], properties: {id: {type: 'string', format: 'uuid'}}};
const count = {anyOf: [{type: 'integer', minimum: 0, maximum: 1000}, {type: 'null'}]};
const roomCounts = {
  type: 'object',
  additionalProperties: false,
  required: ['capacity', 'computerCount'],
  properties: {capacity: count, computerCount: count},
};

async function findRoom(id) {
  const {rows: [room]} = await pool.query(`SELECT ${roomFields} FROM campus.rooms WHERE id = $1`, [id]);
  return room;
}

app.addHook('onRequest', async (request, reply) => {
  const port = app.server.address()?.port;
  const host = request.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    return reply.code(403).send({error: 'local_access_only'});
  }
});

await app.register(async (api) => {
  api.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    if (['cross-site', 'same-site'].includes(request.headers['sec-fetch-site'])) {
      return reply.code(403).send({error: 'same_origin_required'});
    }
  });

  api.setErrorHandler((error, request, reply) => {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({error: 'invalid_request'});
    }
    console.error('Room catalog request failed.');
    return reply.code(503).send({error: 'catalog_unavailable'});
  });

  api.get('/rooms', {
    schema: {querystring: {type: 'object', properties: {buildingId: {type: 'string', maxLength: 64}}}},
  }, async ({query}) => {
    const {rows} = await pool.query(`SELECT ${roomFields} FROM campus.rooms
      WHERE building_id = $1 ORDER BY number`, [query.buildingId ?? 'voznesensky']);
    return {rooms: rows};
  });

  api.get('/rooms/:id', {
    schema: {params: roomId},
  }, async ({params}, reply) => {
    const room = await findRoom(params.id);
    return room ?? reply.code(404).send({error: 'room_not_found'});
  });

  api.patch('/rooms/:id', {
    bodyLimit: 2048,
    schema: {
      params: roomId,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['before', 'after'],
        properties: {before: roomCounts, after: roomCounts},
      },
    },
    onRequest(request, reply, done) {
      if (request.headers.origin !== `http://${request.headers.host}`) {
        reply.code(403).send({error: 'same_origin_required'});
        return;
      }
      done();
    },
  }, async ({params: {id}, body: {before, after}}, reply) => {
    const {rows: [saved]} = await pool.query(`
      UPDATE campus.rooms
      SET capacity = $2, computer_count = $3
      WHERE id = $1
        AND capacity IS NOT DISTINCT FROM $4
        AND computer_count IS NOT DISTINCT FROM $5
      RETURNING ${roomFields}
    `, [id, after.capacity, after.computerCount, before.capacity, before.computerCount]);
    if (saved) return saved;

    const current = await findRoom(id);
    if (!current) return reply.code(404).send({error: 'room_not_found'});
    if (current.capacity === after.capacity && current.computerCount === after.computerCount) return current;
    return reply.code(409).send({error: 'room_changed', room: current});
  });
}, {prefix: '/api/v1'});

try {
  await pool.query('SELECT 1 FROM campus.rooms LIMIT 1');
  const address = await app.listen({port: Number(process.env.ROOMS_PORT || 4183), host: '127.0.0.1'});
  console.log(`Room catalog and campus map available at ${address}/`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void app.close());
} catch {
  await app.close();
  console.error('Could not start the local room catalog. Check PostgreSQL, the import, and the HTTP port.');
  process.exitCode = 1;
}
