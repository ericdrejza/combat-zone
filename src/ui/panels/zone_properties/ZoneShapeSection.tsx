import { useId } from "react";
import { StatusMarkerTooltip } from "@ui/status/StatusMarkerTooltip";
import { Circle, Hexagon, Info, RectangleHorizontal, VectorPolygon } from "lucide-react";

import type { Zone, ZoneShape } from "@entities/zone/types";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

const shapes = [
  { id: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "hexagon", label: "Hexagon", icon: Hexagon },
  { id: "polygon", label: "Polygon", icon: VectorPolygon }
] as const;

type ZoneShapeSectionProps = {
  zone: Zone;
  onConvert: (shape: ZoneShape) => void;
};

export function ZoneShapeSection({ zone, onConvert }: ZoneShapeSectionProps) {
  const helpId = useId();
  const polygonHelp = "With the Zone tool active, double-click an edge to add a vertex at the clicked position. Double-click a vertex to remove it. Keep at least three vertices. Snapping, spacing, and placement rules apply.";
  const { readOnly } = usePersistence();

  return (
    <section className="space-y-3 rounded-2xl border border-canvas-line bg-canvas-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-canvas-ink">Shape</h3>
        {zone.shape === "polygon" ? (
          <StatusMarkerTooltip id={helpId} label={polygonHelp}>
            <button aria-label="Polygon editing help" aria-describedby={helpId}
              className="flex h-8 w-8 items-center justify-center rounded-full text-canvas-muted hover:bg-canvas hover:text-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
              type="button">
              <Info aria-hidden="true" className="h-4 w-4" />
            </button>
          </StatusMarkerTooltip>
        ) : null}
      </div>
      <div aria-label="Zone shape" className="grid grid-cols-4 gap-2">
        {shapes.map(({ id, label, icon: Icon }) => {
          const action = `Convert to ${label.toLowerCase()}`;
          return (
            <TouchTooltip key={id} label={action}>
              <button
                aria-label={action}
                aria-pressed={zone.shape === id}
                disabled={readOnly}
                title={action}
                className={`flex min-h-10 w-full items-center justify-center rounded-xl border border-canvas-line enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50 ${
                  zone.shape === id
                    ? "bg-canvas-ink text-canvas-on-ink"
                    : "bg-canvas-surface text-canvas-muted enabled:hover:bg-canvas"
                }`}
                onClick={() => onConvert(id)}
                type="button"
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </button>
            </TouchTooltip>
          );
        })}
      </div>
    </section>
  );
}
