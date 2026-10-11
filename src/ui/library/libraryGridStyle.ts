/** Minimum width shrinks to the container on compact screens instead of overflowing. */
export function libraryGridStyle(cardSize: number) {
  return { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${cardSize}px), 1fr))` };
}
