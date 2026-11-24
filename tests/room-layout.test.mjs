import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {floorRoomLayout, isFloorFurnitureSurface} from '../public/js/floor-room-layout.js';
import {layoutRoomFurniture} from '../public/js/room-catalog-model.js';

test('floorRoomLayout generates valid furniture parts across real floor spaces and notched polygons', () => {
  const spaces = JSON.parse(readFileSync(new URL('../public/data/floor-spaces.json', import.meta.url), 'utf8'));
  const sampleSpace = spaces.floors.find((f) => f.floor === 4).spaces[0];

  const layout = floorRoomLayout(sampleSpace, {
    number: '478',
    purposes: ['computer', 'laboratory'],
    capacity: 25,
    computerCount: 15,
  });
  assert.ok(layout);
  assert.ok(layout.parts.length > 0);
  assert.ok(Number.isFinite(layout.scaleX) && layout.scaleX > 0);
  assert.ok(Number.isFinite(layout.scaleY) && layout.scaleY > 0);
  assert.ok(Number.isFinite(layout.scaleZ) && layout.scaleZ > 0);

  const surfaces = layout.parts.filter(isFloorFurnitureSurface);
  assert.ok(surfaces.length > 0 && surfaces.length < layout.parts.length);

  // L-shaped notched polygon where bounding-box top-right corner is outside the polygon.
  const notched = {
    id: 'test-l',
    label: '352',
    polygon: [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]],
  };
  const notchedLayout = floorRoomLayout(notched, {
    number: '352',
    purposes: ['practice'],
    capacity: 18,
    computerCount: 0,
  });
  assert.ok(notchedLayout);
  assert.ok(notchedLayout.parts.length > 0);

  // Tiny degenerate polygon returns null cleanly.
  assert.equal(floorRoomLayout({id: 'tiny', label: '0', polygon: [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]]}), null);
});

test('layoutRoomFurniture supports perimeter computer labs, sewing labs, and lecture rooms', () => {
  for (const room of [
    {buildingId: 'voznesensky', number: '478', purposes: ['computer'], capacity: 20, computerCount: 16},
    {buildingId: 'voznesensky', number: '290', purposes: ['laboratory'], capacity: 14, computerCount: 2},
    {buildingId: 'voznesensky', number: '352', purposes: ['practice'], capacity: 20, computerCount: 0},
    {buildingId: 'voznesensky', number: '452', purposes: ['lecture'], capacity: 40, computerCount: 0},
  ]) {
    const boxes = [];
    const {width, depth} = layoutRoomFurniture(room, {w: 8, d: 6}, (...args) => boxes.push(args));
    assert.ok(width > 0 && depth > 0, `dimensions for ${room.number}`);
    assert.ok(boxes.length > 0, `furniture generated for ${room.number}`);
  }
});
