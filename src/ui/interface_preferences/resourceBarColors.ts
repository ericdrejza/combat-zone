export type ResourceBarGradient = { enabled: boolean; low: string; high: string };

export function defaultResourceBarGradient(color: string): ResourceBarGradient {
  return { enabled: false, low: color, high: color };
}

/** Invalid endpoint settings fall back independently to the bar's established default color. */
export function readResourceBarGradient(value: unknown, defaultColor: string): ResourceBarGradient {
  const candidate = value as Partial<ResourceBarGradient> | null;
  const color = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : defaultColor;
  return { enabled: candidate?.enabled === true, low: color(candidate?.low), high: color(candidate?.high) };
}

/** Interpolate one solid sRGB fill using the same clamped fraction as the bar's length. */
export function resourceBarFill(color: string, gradient: ResourceBarGradient, fraction: number): string {
  if (!gradient.enabled) return color;
  const amount = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const channels = [1, 3, 5].map(start => {
    const low = parseInt(gradient.low.slice(start, start + 2), 16);
    const high = parseInt(gradient.high.slice(start, start + 2), 16);
    return Math.round(low + (high - low) * amount).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}
