type Ridge = { x: number; y: number; xx: number; xy: number; yy: number };

/** Local dark-line contrast prevents bold terrain outlines from dominating faint grid lines. */
export function imageRidges(gray: Float32Array, width: number, height: number): Ridge[] {
  const result: Ridge[] = [];
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
    const index = y * width + x, value = gray[index];
    const xx = (gray[index - 2] + gray[index + 2]) / 2 - value;
    const yy = (gray[index - 2 * width] + gray[index + 2 * width]) / 2 - value;
    const xy = (gray[index + 2 * width + 2] + gray[index - 2 * width - 2]
      - gray[index + 2 * width - 2] - gray[index - 2 * width + 2]) / 8;
    result.push({ x: x - width / 2, y: y - height / 2, xx, xy, yy });
  }
  return result;
}

/** Remove broad terrain trends while preserving thin, regularly spaced peaks. */
export function ridgeProfile(ridges: Ridge[], offset: number, angle: number): number[] {
  const c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180);
  const profile = Array<number>(offset * 2 + 1).fill(0);
  const coverage = Array<number>(profile.length).fill(0);
  for (const ridge of ridges) {
    const contrast = Math.min(6, Math.max(0, ridge.xx * c * c + 2 * ridge.xy * c * s + ridge.yy * s * s));
    const position = ridge.x * c + ridge.y * s + offset;
    const index = Math.floor(position), fraction = position - index;
    profile[index] += contrast * (1 - fraction);
    profile[index + 1] += contrast * fraction;
    coverage[index] += 1 - fraction;
    coverage[index + 1] += fraction;
  }
  // Normalize support: diagonal pixel sampling must not manufacture a periodic lattice.
  for (let i = 0; i < profile.length; i++) profile[i] = coverage[i] ? profile[i] / coverage[i] * 100 : 0;
  const sums = [0];
  for (const value of profile) sums.push(sums[sums.length - 1] + value);
  return profile.map((value, index) => {
    const start = Math.max(0, index - 6), end = Math.min(profile.length, index + 7);
    return Math.max(0, value - (sums[end] - sums[start]) / (end - start));
  });
}
