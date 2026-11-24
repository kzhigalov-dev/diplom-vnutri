const size = 64;

function grain(x, y) {
  const hash = Math.imul(x + 1, 1973) ^ Math.imul(y + 1, 9277);
  return ((Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0) & 255) / 255;
}

function mottling(x, y, step) {
  const col = Math.floor(x / step);
  const row = Math.floor(y / step);
  const u = (x % step) / step;
  const v = (y % step) / step;
  const top = grain(col, row) * (1 - u) + grain(col + 1, row) * u;
  const bottom = grain(col, row + 1) * (1 - u) + grain(col + 1, row + 1) * u;
  return top * (1 - v) + bottom * v;
}

const finishes = {
  stone: (x, y) => 229 + 13 * mottling(x, y, 9) + 9 * grain(x, y),
  tile: (x, y) => 217 + 14 * mottling(x, y, 6) + 17 * grain(x, y),
  glass: (x, y) => {
    const sky = y / (size - 1);
    return 204 + 38 * sky + 9 * Math.exp(-((sky - .78) ** 2) / .014);
  },
};

export function architecturalFinish(THREE, surface) {
  const pixels = new Uint8Array(size * size * 4);
  const sample = finishes[surface];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const tone = Math.round(sample(x, y));
      pixels.set([tone, tone, tone, 255], index);
    }
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}
