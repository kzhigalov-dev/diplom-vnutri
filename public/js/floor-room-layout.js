import {roomBounds} from './maquette-layout.js?v=20261112-floor-fit';
import {pilotRoomBySpace} from './pilot-spaces.js?v=20261113-navigation';
import {layoutRoomFurniture} from './room-catalog-model.js?v=20261124-atlas-polish';
import {pointInPolygon} from './walk-navigation.js';

export function floorRoomLayout(space, catalogRoom, depthScale = 1) {
  const sourceBounds = roomBounds(space.polygon);
  const bounds = furnitureBounds(space.polygon, sourceBounds);
  if (!bounds || bounds.w < .24 || bounds.d < .24) return null;
  const displayDepth = bounds.d * depthScale;
  const pilot = pilotRoomBySpace(space.id);
  const room = catalogRoom ?? {
    number: space.label,
    purposes: [pilot?.category === 'computer' ? 'computer' : pilot?.style === 'lecture' ? 'lecture' : 'classroom'],
    capacity: pilot?.seatCount ?? Math.min(30, Math.max(4, Math.round(bounds.w * bounds.d * 3))),
    computerCount: pilot?.category === 'computer' ? pilot.seatCount : 0,
  };
  const parts = [];
  const {width, depth} = layoutRoomFurniture(room, sourceBounds,
    (color, x, y, z, w, h, d, angle = 0, name = '') => {
      if (color !== null && name !== 'equipment-detail') parts.push({color, x, y, z, w, h, d, angle, name});
    });
  return {
    parts,
    x: bounds.x,
    z: bounds.z,
    scaleX: .96 * bounds.w / width,
    scaleZ: .96 * bounds.d / depth,
    scaleY: Math.min(.85, .96 * bounds.w / width, .96 * displayDepth / depth),
  };
}

const overviewParts = new Set(['desk-top', 'chair-seat', 'teacher-seat', 'equipment', 'monitor-screen', 'teaching-board']);
export function isFloorFurnitureSurface(part) {
  return overviewParts.has(part.name);
}

function furnitureBounds(polygon, bounds) {
  const inset = Math.min(.14, bounds.w * .07, bounds.d * .07);
  const x0 = bounds.x - bounds.w / 2 + inset;
  const z0 = bounds.z - bounds.d / 2 + inset;
  const w = bounds.w - inset * 2;
  const d = bounds.d - inset * 2;
  if (rectangleFits(polygon, x0, z0, x0 + w, z0 + d)) return {...bounds, w, d};

  // The scanned plans include rooms with notches and angled walls. Find an
  // open rectangle inside each footprint before scaling the furniture into it.
  const divisions = 12;
  const dx = w / divisions;
  const dz = d / divisions;
  const rows = Array.from({length: divisions}, (_, row) =>
    Array.from({length: divisions}, (_, col) =>
      rectangleFits(polygon, x0 + dx * col, z0 + dz * row, x0 + dx * (col + 1), z0 + dz * (row + 1))));
  const heights = Array(divisions).fill(0);
  let best = null;
  let area = 0;
  for (const [row, valid] of rows.entries()) {
    for (let col = 0; col < divisions; col += 1) heights[col] = valid[col] ? heights[col] + 1 : 0;
    for (let left = 0; left < divisions; left += 1) {
      let height = heights[left];
      for (let right = left; right < divisions && height; right += 1) {
        height = Math.min(height, heights[right]);
        const width = right - left + 1;
        if (width * height <= area) continue;
        area = width * height;
        best = {x: x0 + dx * (left + width / 2), z: z0 + dz * (row + 1 - height / 2), w: dx * width, d: dz * height};
      }
    }
  }
  return best;
}

function rectangleFits(polygon, left, top, right, bottom) {
  return [[left, top], [left, bottom], [right, top], [right, bottom]].every(point => pointInPolygon(point, polygon)) &&
    !polygon.some((a, index) => segmentMeetsRectangle(a, polygon[(index + 1) % polygon.length], left, top, right, bottom));
}

function segmentMeetsRectangle([ax, az], [bx, bz], left, top, right, bottom) {
  if (Math.max(ax, bx) < left || Math.min(ax, bx) > right || Math.max(az, bz) < top || Math.min(az, bz) > bottom) return false;
  const dx = bx - ax;
  const dz = bz - az;
  if (dx === 0 || dz === 0) return true;
  const [x0, x1] = dx > 0 ? [left, right] : [right, left];
  const [z0, z1] = dz > 0 ? [top, bottom] : [bottom, top];
  return Math.max(0, (x0 - ax) / dx, (z0 - az) / dz) <= Math.min(1, (x1 - ax) / dx, (z1 - az) / dz);
}
