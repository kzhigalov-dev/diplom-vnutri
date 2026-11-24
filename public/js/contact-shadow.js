export const contactShadowSize = 32;

export function makeContactShadow() {
  const size = contactShadowSize;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
      const offset = (y * size + x) * 4;
      data[offset] = 34;
      data[offset + 1] = 31;
      data[offset + 2] = 25;
      data[offset + 3] = Math.round(72 * Math.max(0, 1 - radius) ** 2);
    }
  }
  return data;
}
