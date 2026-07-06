import { RENDER_LAYERS } from "../../core/rendering/types";
import type { SelectionOverlayTarget } from "../../interaction/selection/types";

const placeholderSelectionTargets: SelectionOverlayTarget[] = [
  {
    id: "selection-placeholder",
    entityType: "zone",
    label: "Selection overlay placeholder"
  }
];

export function CanvasShell() {
  return (
    <section
      aria-label="Encounter canvas"
      className="relative min-h-[32rem] overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm"
      role="main"
    >
      <svg
        aria-label="SVG encounter workspace"
        className="h-full min-h-[32rem] w-full bg-[#fffaf0]"
        role="img"
        viewBox="0 0 960 640"
      >
        {RENDER_LAYERS.map((layer) => (
          <g
            key={layer.id}
            aria-label={`${layer.label} layer`}
            data-layer={layer.id}
          >
            {layer.id === "background" ? (
              <>
                <rect fill="#fffaf0" height="640" width="960" />
                <path
                  d="M0 560 C160 500 240 620 390 560 S650 480 960 560"
                  fill="none"
                  stroke="#d7cbb8"
                  strokeWidth="3"
                />
              </>
            ) : null}
            {layer.id === "uiOverlays"
              ? placeholderSelectionTargets.map((target) => (
                  <rect
                    key={target.id}
                    aria-label={target.label}
                    className="fill-transparent stroke-canvas-ink stroke-2 opacity-35"
                    data-entity-type={target.entityType}
                    height="96"
                    rx="16"
                    strokeDasharray="8 8"
                    width="160"
                    x="400"
                    y="272"
                  />
                ))
              : null}
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-canvas-line bg-canvas-panel/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-canvas-muted">
        Canvas scaffold
      </div>
    </section>
  );
}
