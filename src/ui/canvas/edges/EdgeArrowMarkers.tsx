type Props = { id: string; color: string; thickness: number; startAngle: string | number; endAngle: string | number };

export function EdgeArrowMarkers({ id, color, thickness, startAngle, endAngle }: Props) {
  return <defs>
    <marker id={`edge-arrow-end-${id}`} markerUnits="userSpaceOnUse" viewBox="0 0 8 8" markerHeight={8 * thickness} markerWidth={8 * thickness} orient={endAngle} refX="7" refY="4"><path d="M 0 0 L 8 4 L 0 8 z" fill={color} /></marker>
    <marker id={`edge-arrow-start-${id}`} markerUnits="userSpaceOnUse" viewBox="0 0 8 8" markerHeight={8 * thickness} markerWidth={8 * thickness} orient={startAngle} refX="7" refY="4"><path d="M 0 0 L 8 4 L 0 8 z" fill={color} /></marker>
  </defs>;
}
