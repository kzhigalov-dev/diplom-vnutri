export function createComputerStickerSurface(THREE, roomNumber, placements) {
  if (!placements.length || typeof document === 'undefined') return null;

  const cellWidth = 96;
  const cellHeight = 32;
  const columns = Math.min(16, placements.length);
  const canvas = document.createElement('canvas');
  canvas.width = columns * cellWidth;
  canvas.height = Math.ceil(placements.length / columns) * cellHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#f2eee4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#242927';
  ctx.font = 'bold 23px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const positions = [];
  const uvs = [];
  const indices = [];
  for (const [index, [x, y, z, width, height, rotation]] of placements.entries()) {
    const cellX = (index % columns) * cellWidth;
    const cellY = Math.floor(index / columns) * cellHeight;
    ctx.fillText(`${roomNumber}-${index + 1}`, cellX + cellWidth / 2, cellY + cellHeight / 2, cellWidth - 10);

    const dx = Math.cos(rotation) * width / 2;
    const dz = -Math.sin(rotation) * width / 2;
    const dy = height / 2;
    positions.push(x - dx, y - dy, z - dz, x + dx, y - dy, z + dz,
      x + dx, y + dy, z + dz, x - dx, y + dy, z - dz);

    // The inset keeps texture filtering away from the neighboring sticker.
    const left = (cellX + 2) / canvas.width;
    const right = (cellX + cellWidth - 2) / canvas.width;
    const top = 1 - (cellY + 2) / canvas.height;
    const bottom = 1 - (cellY + cellHeight - 2) / canvas.height;
    uvs.push(left, bottom, right, bottom, right, top, left, top);
    const first = index * 4;
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {geometry, texture};
}
