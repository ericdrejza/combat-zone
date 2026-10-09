export type ProfileFit = { spacing: number; phase: number; score: number };
export function fitProfile(profile: number[]): ProfileFit | null {
  const mean = profile.reduce((sum, value) => sum + value, 0) / profile.length;
  if (mean < 0.5) return null;
  const centered = profile.map(value => value - mean);
  const candidates: { spacing: number; correlation: number }[] = [];
  for (let spacing = 8; spacing <= Math.min(128, profile.length / 4); spacing++) {
    let sum = 0, a = 0, b = 0;
    for (let i = 0; i + spacing < profile.length; i++) {
      sum += centered[i] * centered[i + spacing]; a += centered[i] ** 2; b += centered[i + spacing] ** 2;
    }
    candidates.push({ spacing, correlation: sum / Math.sqrt(a * b || 1) });
  }
  // Harmonics can correlate more strongly after image resampling; prefer the fundamental period.
  const fundamentalScore = (value: { spacing: number; correlation: number }) => value.correlation / (1 + value.spacing * 0.01);
  candidates.sort((a, b) => fundamentalScore(b) - fundamentalScore(a) || a.spacing - b.spacing);
  let best: ProfileFit | null = null;
  for (const candidate of candidates.slice(0, 5)) {
    if (candidate.correlation < 0.25) continue;
    for (let spacing = candidate.spacing - 0.75; spacing <= candidate.spacing + 0.75; spacing += 0.25) {
      for (let phase = 0; phase < spacing; phase += 0.5) {
        let sum = 0, count = 0;
        for (let x = phase; x < profile.length - 1; x += spacing) {
          const index = Math.floor(x), fraction = x - index;
          sum += profile[index] * (1 - fraction) + profile[index + 1] * fraction; count++;
        }
        const contrast = sum / (count * mean);
        const score = candidate.correlation * contrast / (contrast + 1) * (1 + 0.02 * Math.min(count, 20)) / (1 + spacing * 0.01);
        if (contrast >= 1.7 && (!best || score > best.score)) best = { spacing, phase, score };
      }
    }
  }
  return best;
}

export function imageContrasts(pixels: Uint8ClampedArray, width: number, height: number) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722;
  const edges: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const dx = gray[y * width + x + 1] - gray[y * width + x - 1];
    const dy = gray[(y + 1) * width + x] - gray[(y - 1) * width + x];
    if (Math.hypot(dx, dy) > 12) edges.push({ x: x - width / 2, y: y - height / 2, dx, dy });
  }
  return { gray, edges };
}
export function lineProfile(edges: ReturnType<typeof imageContrasts>['edges'], offset: number, angle: number) {
  const c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180);
  const result = Array(offset * 2 + 1).fill(0) as number[];
  for (const edge of edges) result[Math.round(edge.x * c + edge.y * s) + offset] += Math.abs(edge.dx * c + edge.dy * s);
  return result;
}
export function centralPhase(phase: number, spacing: number, offset: number) {
  return ((phase - offset + spacing / 2) % spacing + spacing) % spacing - spacing / 2;
}
