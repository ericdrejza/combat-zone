export type HsvColor = { h: number; s: number; v: number };

export function hexToHsv(hex: string, fallbackHue = 0): HsvColor {
  const [r, g, b] = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = !delta ? fallbackHue : max === r ? ((g - b) / delta + 6) % 6 * 60
    : max === g ? ((b - r) / delta + 2) * 60 : ((r - g) / delta + 4) * 60;
  return { h: hue, s: max ? delta / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: HsvColor): string {
  const channel = (offset: number) => {
    const k = (offset + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}
