type CanvasToolStatusBadgeProps = {
  activeToolId: string;
  zoneShapeMode: string;
};

export function CanvasToolStatusBadge({
  activeToolId,
  zoneShapeMode
}: CanvasToolStatusBadgeProps) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-canvas-line bg-canvas-panel/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-canvas-muted">
      {activeToolId === "zone" ? `Zone shape: ${zoneShapeMode}` : "Canvas scaffold"}
    </div>
  );
}
