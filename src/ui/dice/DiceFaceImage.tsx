/** Dice are domain artwork, rendered as scalable native SVG rather than control icons. */
export function DiceFaceImage({ face, sides }: { face: number; sides: number }) {
  const shape = sides === 4 ? "20,2 38,36 2,36" : sides === 6 ? "4,4 36,4 36,36 4,36" : "20,2 37,11 37,29 20,38 3,29 3,11";
  return <svg aria-hidden="true" viewBox="0 0 40 40" className="h-10 w-10 shrink-0"><polygon points={shape} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" /><text x="20" y={sides === 4 ? "28" : "25"} textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">{face}</text></svg>;
}
