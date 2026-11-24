import {catalogPhotoReference} from './room-catalog.js?v=20261123-room-realism';
import {contactShadowSize,makeContactShadow} from './contact-shadow.js';
import {createComputerStickerSurface} from './computer-stickers.js?v=20261124-room-style';
import {architecturalFinish} from './architectural-finishes.js?v=20261124-atlas-polish';

const steel = 0x717c7d;
const chrome = 0xa0acac;
const wood = 0xcdab7d;
const plywood = 0xb89466;
const laminate = 0xe2e3de;
const panel = 0xc4c7c4;
const dark = 0x303637;
const plastic = 0x3f4648;
const screen = 0x7697a7;
export const roomFloorColor = 0x9a9b93;

function roomProfile(room) {
  const photo = catalogPhotoReference(room);
  const lecture = room.purposes.includes('lecture');
  const laboratory = room.purposes.includes('laboratory');
  const computerClass = room.purposes.includes('computer');
  const computers = room.computerCount ?? 0;
  const seats = room.capacity ?? Math.max(computers, 6);
  const woodFurniture = Boolean(photo?.doubleChalkboard || photo?.sewingMachines);
  return {photo, lecture, laboratory, computerClass, woodFurniture, computers, seats};
}

export function layoutRoomFurniture(room, bounds, box) {
  const profile = roomProfile(room);
  const [width, depth] = roomDimensions(room, bounds, profile);
  drawRoomFurniture(box, width, depth, profile);
  return {width, depth};
}

function drawRoomFurniture(box, width, depth, profile) {
  const {photo, computerClass, laboratory, computers, seats} = profile;
  if (photo?.computersAlongWalls) {
    drawComputerClassroom(box, width, depth, computers, seats);
  } else {
    drawTeachingWall(box, width, depth, profile);
    const layout = photo?.sewingMachines ? 'sewing' : computerClass ? 'computers' : laboratory ? 'lab' : 'desks';
    drawDeskRows(box, width, depth, seats, computers, layout, profile);
    if (photo?.sewingMachines) drawSewingTables(box, width, depth);
    else if (laboratory && !computerClass) drawLabStorage(box, width, depth);
  }
}

export function createCatalogModel(THREE, room, bounds) {
  const profile = roomProfile(room);
  const [width, depth] = roomDimensions(room, bounds, profile);
  const parts = new Map();
  const stickers = [];

  function box(color, x, y, z, width, height, depth, angle = 0, name = '') {
    if (name === 'computer-sticker') {
      stickers.push([x, y, z, width, height, angle]);
      return;
    }
    const key = name ? `${name}:${color}` : color;
    if (!parts.has(key)) parts.set(key, {color, name, instances: []});
    parts.get(key).instances.push([x, y, z, width, height, depth, angle]);
  }

  drawShell(box, width, depth, profile);
  drawRoomFurniture(box, width, depth, profile);

  const geometry = new THREE.BoxGeometry();
  const group = new THREE.Group();
  const transform = new THREE.Object3D();
  for (const {color, name, instances} of parts.values()) {
    const finish = name === 'window-glass' ? 'glass' : name === 'floor-surface' ? 'tile' : null;
    const material = new THREE.MeshStandardMaterial({
      color,
      map: finish ? architecturalFinish(THREE, finish) : null,
      roughness: finish === 'glass' ? .33 : .8,
      metalness: color === chrome ? .2 : 0,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    mesh.name = name;
    instances.forEach(([x, y, z, w, h, d, angle], index) => {
      transform.position.set(x, y, z);
      transform.rotation.y = angle;
      transform.scale.set(w, h, d);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  const shadow = furnitureShadows(THREE, parts, transform, width, depth);
  if (shadow) group.add(shadow);
  const stickerSurface = createComputerStickerSurface(THREE, room.number, stickers);
  if (stickerSurface) {
    const stickerMaterial = new THREE.MeshBasicMaterial({map: stickerSurface.texture, toneMapped: false});
    const stickerMesh = new THREE.Mesh(stickerSurface.geometry, stickerMaterial);
    stickerMesh.name = 'computer-stickers';
    group.add(stickerMesh);
  }

  return {
    group,
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      for (const mesh of group.children) {
        if (mesh.geometry !== geometry) mesh.geometry.dispose();
        mesh.material.map?.dispose();
        mesh.material.dispose();
        if (mesh.isInstancedMesh) mesh.dispose();
      }
    },
  };
}

function furnitureShadows(THREE, parts, transform, roomWidth, roomDepth) {
  const furniture = [...parts.values()].filter(({name}) => name === 'desk-top' || name.endsWith('-seat'));
  const count = furniture.reduce((total, {instances}) => total + instances.length, 0);
  if (!count) return null;

  const texture = new THREE.DataTexture(makeContactShadow(), contactShadowSize, contactShadowSize, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false});
  const shadows = new THREE.InstancedMesh(plane, material, count);
  shadows.name = 'furniture-shadows';
  let index = 0;
  for (const {instances} of furniture) {
    for (const [x, , z, width, , depth, angle] of instances) {
      const w = width * 1.28;
      const d = depth * 1.75;
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      // Keep the feathered shadow on the cutaway floor.
      const scale = Math.min(1, Math.max(.001, roomWidth - Math.abs(x) * 2) / (w * cos + d * sin),
        Math.max(.001, roomDepth - Math.abs(z) * 2) / (w * sin + d * cos));
      transform.position.set(x, .012, z);
      transform.rotation.y = angle;
      transform.scale.set(w * scale, 1, d * scale);
      transform.updateMatrix();
      shadows.setMatrixAt(index++, transform.matrix);
    }
  }
  shadows.computeBoundingSphere();
  return shadows;
}

function roomDimensions(room, bounds, profile) {
  const nominalSeats = Math.max(1, room.capacity ?? room.computerCount ?? 10);
  const areaPerSeat = profile.laboratory ? 2.15 : profile.computerClass ? 1.85 : profile.lecture ? 1.3 : 1.55;
  const area = profile.photo?.computersAlongWalls ? 59 : Math.max(29, nominalSeats * areaPerSeat + 20);
  const proportion = bounds?.w > 0 && bounds?.d > 0 ? bounds.w / bounds.d : 1.2;
  const ratio = Math.min(1.8, Math.max(.74, proportion));
  return [Math.sqrt(area * ratio), Math.sqrt(area / ratio)];
}

function drawShell(box, width, depth, {photo, woodFurniture}) {
  const perimeter = photo?.computersAlongWalls;
  const plaster = woodFurniture ? 0xdfdcd0 : 0xd3d2ca;
  const wallHeight = 3.12;
  const exterior = .18;
  const left = -width / 2;
  const back = -depth / 2;
  box(0xb6b1a5, 0, -.14, 0, width + .28, .26, depth + .28);
  box(0xd1cbbd, 0, -.027, 0, width + .19, .03, depth + .19);
  box(0xa7a89f, 0, -.006, 0, width, .014, depth, 0, 'floor-surface');
  // The tile lines sit in the surface and stay below the furniture.
  for (let x = left + .48; x < -left; x += .48) box(0x90928b, x, .002, 0, .007, .002, depth);
  for (let z = back + .48; z < -back; z += .48) box(0x90928b, 0, .002, z, width, .002, .007);
  box(plaster, 0, wallHeight / 2, back - exterior / 2, width + 2 * exterior, wallHeight, exterior);
  box(0xa5a499, 0, .063, back + .016, width, .125, .035);
  box(0xa5a499, left + .017, .063, 0, .035, .125, depth);

  const center = perimeter ? -depth * .13 : 0;
  const windows = perimeter ? 1 : Math.min(4, Math.max(1, Math.round(depth / 2.85)));
  const span = perimeter ? Math.min(4.4, depth * .63) : Math.min(1.72, depth / windows - .64);
  const sill = perimeter ? 1.02 : .91;
  const windowTop = 2.76;
  const windowHeight = windowTop - sill;
  box(plaster, left - exterior / 2, sill / 2, 0, exterior, sill, depth);
  box(plaster, left - exterior / 2, (windowTop + wallHeight) / 2, 0, exterior, wallHeight - windowTop, depth);
  let edge = back;
  for (let i = 0; i < windows; i += 1) {
    const z = center + depth * ((i + .5) / windows - .5);
    const opening = z - span / 2;
    box(plaster, left - exterior / 2, sill + windowHeight / 2, (edge + opening) / 2, exterior, windowHeight, opening - edge);
    drawWindow(box, left, z, span, sill, windowHeight, perimeter);
    edge = z + span / 2;
  }
  box(plaster, left - exterior / 2, sill + windowHeight / 2, (edge - back) / 2, exterior, windowHeight, -back - edge);

  // The ceiling is cut back along the walls so the interior remains inspectable.
  box(0xdad9ce, 0, wallHeight - .04, back + .21, width, .09, .44);
  box(0xdad9ce, left + .20, wallHeight - .04, .23, .43, .09, depth - .45);
  for (const x of [-width * .27, width * .27]) {
    box(0xc1c3bc, x, wallHeight - .106, back + .22, Math.min(1.2, width * .25), .033, .27);
    box(0xeeeedd, x, wallHeight - .124, back + .22, Math.min(1.12, width * .24), .014, .21);
  }
}

function drawWindow(box, x, z, width, sill, height, clear) {
  const frame = clear ? 0x777d78 : 0xdad9d1;
  const glassY = sill + height / 2;
  box(0xb7cdd4, x - .125, glassY, z, .023, height - .055, width - .06, 0, 'window-glass');
  box(0xf0eee4, x - .014, sill - .016, z, .38, .068, width + .11);
  for (const offset of [-height / 2 + .018, height / 2 - .018]) {
    box(frame, x - .073, glassY + offset, z, .105, .047, width);
  }
  for (const offset of [-.487, -.166, .166, .487]) {
    box(frame, x - .073, glassY, z + width * offset, .104, height, .054);
  }
  box(frame, x - .066, sill + height * .78, z, .087, .055, width);
  if (!clear) {
    const slats = Math.ceil(width / .09);
    const slatHeight = height * .8;
    for (let i = 0; i < slats; i += 1) {
      box(i % 2 ? 0xe2dfd5 : 0xe9e7df, x + .018, sill + height - slatHeight / 2 - .065,
        z + width * ((i + .5) / slats - .5), .02, slatHeight, width / slats * .82, .32);
    }
  }
  const radiatorWidth = width * .78;
  box(0xd1d2c5, x + .116, .42, z, .146, .53, radiatorWidth);
  const fins = Math.ceil(radiatorWidth / .077);
  for (let i = 0; i < fins; i += 1) {
    box(0xe2e1d5, x + .2, .42, z + radiatorWidth * ((i + .5) / fins - .5), .035, .48, .039);
  }
  box(0xa7a99f, x + .101, .18, z + radiatorWidth * .51, .035, .035, .1);
}

function drawTeachingWall(box, width, depth, {photo, lecture, laboratory, woodFurniture}) {
  const back = -depth / 2;
  const wallInset = .25;
  const projectionWidth = lecture ? Math.min(width * .28, 1.9) : 0;
  const projectionRight = width / 2 - wallInset;
  const boardLeft = -width / 2 + wallInset;
  const boardRight = lecture ? projectionRight - projectionWidth - .23 : projectionRight;
  const boardWidth = Math.min(4.3, width * (photo?.doubleChalkboard ? .69 : lecture ? .63 : .49), boardRight - boardLeft);
  const boardX = (boardLeft + boardRight) / 2;
  const chalkboard = lecture || laboratory || photo?.sewingMachines || photo?.doubleChalkboard;
  drawBoard(box, boardX, 1.77, back + .04, boardWidth, 1.08, chalkboard, photo?.doubleChalkboard);
  if (photo?.doubleChalkboard) {
    box(0xcecec2, boardX, 2.47, back + .079, boardWidth + .18, .061, .13);
    box(0xf0eee1, boardX, 2.431, back + .102, boardWidth + .07, .018, .1);
  }
  if (lecture) {
    const projectionX = projectionRight - projectionWidth / 2;
    box(0xdfded2, projectionX, 2.69, back + .125, projectionWidth + .13, .08, .11);
    box(0xf1f1ea, projectionX, 2.04, back + .117, projectionWidth, 1.24, .022, 0, 'teaching-board');
    for (const offset of [-.5, .5]) {
      box(0x62665f, projectionX + projectionWidth * offset, 2.04, back + .131, .027, 1.24, .018);
    }
    box(dark, projectionX, 1.42, back + .126, projectionWidth + .02, .025, .03);
  }

  const teacherX = width * .25;
  const teacherZ = back + .91;
  const finish = woodFurniture ? plywood : panel;
  desk(orient(box, teacherX, teacherZ), woodFurniture ? wood : laminate, 1.36, .58, .747);
  box(finish, teacherX, .5, teacherZ + .19, 1.23, .38, .024);
  chair(orient(box, teacherX, teacherZ - .53, Math.PI), finish, .92, !woodFurniture, 'teacher-seat');
}

function drawBoard(box, x, y, z, width, height, chalkboard, doublePanel = false) {
  const surface = chalkboard ? 0x425b50 : 0xe9e9e1;
  box(0xa2a194, x, y, z, width + .075, height + .075, .081);
  box(surface, x, y, z + .047, width, height, .024, 0, 'teaching-board');
  if (chalkboard && width > 1.55) {
    for (const offset of doublePanel ? [0] : [-.245, .245]) {
      box(0x989b8b, x + width * offset, y, z + .061, .024, height, .016);
    }
  }
  box(0xb1b3a5, x, y - height / 2 - .043, z + .081, width * .85, .028, .082);
  box(chalkboard ? 0xece9d2 : 0x5b6363, x - width * .22, y - height / 2 - .019, z + .089, .078, .014, .022);
}

function drawDeskRows(box, width, depth, seats, computers, layout, {lecture, woodFurniture}) {
  const count = Math.max(seats, computers);
  if (!count) return;
  const teachingDepth = lecture ? 2.07 : 1.7;
  const roomLeft = -width / 2 + .52;
  const usableWidth = width - (layout === 'sewing' ? 2.03 : 1.08);
  const desktop = layout === 'computers' ? .88 : layout === 'lab' ? .83 : .68;
  const aisles = count > 12 ? .82 : 0;
  const columns = Math.min(count, Math.max(1, Math.floor((usableWidth - aisles) / desktop)));
  const rows = Math.ceil(count / columns);
  const pitchX = (usableWidth - aisles) / columns;
  const pitchZ = (depth - teachingDepth - .45) / rows;
  const midpoint = Math.ceil(columns / 2);
  const scale = Math.min(1, pitchX / .63, pitchZ / (layout === 'desks' ? .9 : 1.05));
  const tableTop = woodFurniture ? wood : laminate;
  const seatFinish = woodFurniture ? plywood : panel;
  const tableDepth = (layout === 'lab' ? .68 : layout === 'computers' ? .64 : .49) * scale;
  const tableHeight = .747 * scale;

  for (let row = 0; row < rows; row += 1) {
    const rowStart = row * columns;
    const inRow = Math.min(columns, count - rowStart);
    const z = -depth / 2 + teachingDepth + pitchZ * (row + .27);
    for (let col = 0; col < inRow;) {
      // Double desks share a frame. Keep the aisle free when a row is split.
      const boundary = aisles && col < midpoint ? Math.min(inRow, midpoint) : inRow;
      const places = Math.min(2, boundary - col);
      const base = roomLeft + pitchX * col + (col >= midpoint ? aisles : 0);
      const x = base + pitchX * places / 2;
      const span = pitchX * places - Math.min(.082, pitchX * .1);
      const placeTable = orient(box, x, z);
      desk(placeTable, tableTop, span, tableDepth, tableHeight, scale);
      if (!woodFurniture) {
        placeTable(panel, 0, tableHeight * .76, -tableDepth * .36, span * .93, .31 * scale, .023 * scale);
      }
      if (layout === 'lab') {
        placeTable(0xa9b0aa, 0, tableHeight + .07 * scale, -tableDepth * .36, span - .08 * scale, .13 * scale, .052 * scale);
      }
      for (let i = 0; i < places; i += 1) {
        const index = rowStart + col + i;
        const slot = base + pitchX * (i + .5);
        if (index < seats) {
          chair(orient(box, slot, z + tableDepth / 2 + .29 * scale), seatFinish, scale, !woodFurniture);
        }
        if (index < computers) {
          computer(orient(box, slot, z), tableHeight + .032, scale);
        }
      }
      col += places;
    }
  }
}

function drawComputerClassroom(box, width, depth, computers, seats) {
  const left = -width / 2;
  const back = -depth / 2;
  const counters = [
    {x: left + .39, z: .31, length: depth - 1.16, rotation: Math.PI / 2},
    {x: 0, z: back + .38, length: width - 1.32, rotation: 0},
    {x: -left - .39, z: .31, length: depth - 1.16, rotation: -Math.PI / 2},
  ];
  const sideSeats = Math.min(seats, computers);

  for (const [index, {x, z, length, rotation}] of counters.entries()) {
    const counter = orient(box, x, z, rotation);
    desk(counter, laminate, length, .67, .749);
    for (let i = 0, supports = Math.floor(length / 1.5); i < supports; i += 1) {
      const along = length * ((i + 1) / (supports + 1) - .5);
      counter(steel, along, .365, -.24, .038, .73, .038);
    }
    // Photos show a continuous outlet raceway above the work surface.
    if (rotation >= 0) {
      counter(0xdcdad2, 0, .938, -.382, length, .112, .041);
      const outlets = Math.floor(length / .8);
      for (let i = 0; i < outlets; i += 1) {
        counter(0xa16e63, length * ((i + .5) / outlets - .5), .938, -.359, .076, .042, .012);
      }
    }
    const slots = Math.floor(computers * (index + 1) / counters.length) - Math.floor(computers * index / counters.length);
    const occupied = Math.floor(sideSeats * (index + 1) / counters.length) - Math.floor(sideSeats * index / counters.length);
    for (let i = 0; i < slots; i += 1) {
      const along = length * ((i + .5) / slots - .5);
      const scale = Math.min(1, length / slots / .81);
      computer(orient(counter, along, 0), .78, scale);
      if (i < occupied) {
        chair(orient(counter, along, .61), panel, scale, true);
      }
    }
  }

  const tableLength = width - 3.15;
  const extraSeats = seats - sideSeats;
  const rows = 3;
  for (let row = 0; row < rows; row += 1) {
    const z = -depth * .22 + depth * .185 * row;
    const table = orient(box, 0, z);
    desk(table, laminate, tableLength, .59, .751);
    table(panel, 0, .526, .25, tableLength - .12, .38, .023);
    const inRow = Math.floor(extraSeats * (row + 1) / rows) - Math.floor(extraSeats * row / rows);
    for (let i = 0; i < inRow; i += 1) {
      chair(orient(box, tableLength * ((i + .5) / inRow - .5), z + .57), panel,
        Math.min(1, tableLength / inRow / .51), true);
    }
  }
  const boardX = width * -.28;
  drawBoard(box, boardX, 1.53, back + .17, 1.17, .77, false);
  for (const x of [boardX - .49, boardX + .49]) box(steel, x, .57, back + .17, .031, 1.15, .035);
}

function drawSewingTables(box, width, depth) {
  const benches = Math.min(6, Math.max(2, Math.floor(depth / 1.39) - 1));
  const x = width / 2 - .56;
  for (let i = 0; i < benches; i += 1) {
    const z = -depth / 2 + 1.45 + (depth - 2.18) * ((i + .5) / benches);
    const table = orient(box, x, z, -Math.PI / 2);
    desk(table, laminate, 1.09, .64, .75);
    table(0xb9bfb0, 0, .792, -.03, .51, .046, .29);
    table(0xd4d6c8, .18, .914, -.08, .19, .27, .25);
    table(0xd4d6c8, .005, 1.006, -.08, .49, .13, .22, 0, 'equipment');
    table(0x7a8380, .23, 1.014, .046, .13, .13, .047);
    table(steel, -.205, .904, -.085, .03, .161, .047);
    table(chrome, -.205, .825, -.06, .014, .09, .015);
    table(steel, -.39, .998, -.25, .022, .46, .022);
    table(0xc4a581, -.39, 1.141, -.25, .062, .1, .057);
    table(dark, 0, .108, .02, .21, .056, .23);
  }
}

function drawLabStorage(box, width, depth) {
  const x = -width * .27;
  const z = -depth / 2 + .32;
  box(panel, x, .452, z, 1.37, .89, .52);
  box(laminate, x, .914, z, 1.44, .043, .57, 0, 'equipment');
  for (const offset of [-.34, .34]) {
    box(0xd3d5d0, x + offset, .493, z + .271, .637, .67, .035);
    box(steel, x + offset, .667, z + .303, .109, .021, .021);
  }
  for (const offset of [-.34, .25]) {
    box(0xc3c7bb, x + offset, 1.052, z, .34, .233, .26);
    box(0x7a8378, x + offset, 1.081, z + .137, .23, .079, .023);
    box(0x4b504c, x + offset + .1, 1.002, z + .14, .038, .04, .031);
  }
}

function orient(box, x, z, angle = 0) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return (color, u, y, v, w, h, d, rotation = 0, name = '') => {
    box(color, x + u * cosine + v * sine, y, z - u * sine + v * cosine, w, h, d, angle + rotation, name);
  };
}

function desk(box, finish, width, depth, height, scale = 1) {
  box(finish, 0, height, 0, width, .052 * scale, depth, 0, 'desk-top');
  const legInset = Math.min(.086 * scale, width * .2);
  for (const x of [-width / 2 + legInset, width / 2 - legInset]) {
    for (const z of [-depth * .36, depth * .36]) {
      box(steel, x, height * .49, z, .038 * scale, height * .98, .038 * scale);
    }
    box(steel, x, height * .19, 0, .03 * scale, .034 * scale, depth * .72);
  }
  box(steel, 0, height * .85, -depth * .35, width - legInset, .047 * scale, .033 * scale);
}

function chair(box, finish, scale, ladder = false, seatName = 'chair-seat') {
  const part = (color, x, y, z, w, h, d, angle = 0, name = '') =>
    box(color, x * scale, y * scale, z * scale, w * scale, h * scale, d * scale, angle, name);
  const metal = ladder ? chrome : steel;
  const seatWidth = ladder ? .39 : .42;
  part(finish, 0, .45, 0, seatWidth, .036, .368, 0, seatName);
  for (const x of [-.166, .166]) {
    part(metal, x, .22, -.132, .022, .44, .024);
    part(metal, x, .409, .151, .022, .818, .024);
    part(metal, x, .364, .011, .023, .024, .283);
  }
  if (ladder) {
    for (const y of [.683, .786]) part(metal, 0, y, .153, .353, .022, .026);
  } else {
    part(finish, 0, .721, .159, .386, .16, .026);
  }
}

function computer(box, surfaceY, scale) {
  const part = (color, x, y, z, w, h, d, name = '') =>
    box(color, x * scale, surfaceY + y * scale, z * scale, w * scale, h * scale, d * scale, 0, name);
  part(plastic, 0, .017, -.113, .243, .03, .165);
  part(dark, 0, .101, -.143, .057, .171, .057);
  part(dark, 0, .26, -.143, .45, .284, .063);
  part(screen, 0, .267, -.106, .411, .231, .014, 'monitor-screen');
  part(0x405e74, -.084, .292, -.097, .172, .138, .003);
  part(0x94a9ae, .077, .223, -.096, .141, .045, .003);
  part(dark, 0, .014, .121, .331, .025, .112);
  for (const row of [0, 1, 2, 3]) {
    part(0x656b6a, -.027, .028, .084 + row * .018, .188, .005, .011, 'equipment-detail');
    part(0x656b6a, .109, .028, .084 + row * .018, .058, .005, .011, 'equipment-detail');
  }
  part(0x78807d, -.033, .028, .157, .10, .005, .010, 'equipment-detail');
  part(dark, .232, .018, .13, .047, .029, .07);
  part(dark, .318, .154, -.148, .122, .305, .306, 'equipment');
  part(plastic, .318, .148, .011, .108, .253, .013);
  part(0x7b9487, .319, .246, .021, .022, .014, .004);
  for (const y of [.052, .070, .088, .106]) {
    part(0x202629, .318, y, .019, .073, .006, .004, 'equipment-detail');
  }
  part(null, .318, .176, .019, .102, .034, 0, 'computer-sticker');
}

