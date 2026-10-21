/** Fit beside the name/health group without exceeding its height or wrapping below it. */
export function healthRowImageSize(rowWidth: number, contentWidth: number, contentHeight: number, gap: number): number {
  const remaining = Math.floor(rowWidth - contentWidth - gap);
  const size = Math.floor(Math.min(remaining, contentHeight));
  return size >= 96 ? size : 0;
}
