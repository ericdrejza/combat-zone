import { Ban, ChevronsDown, Dices, EyeDashed, EyeOff, Info, Tag } from "lucide-react";
import { useState } from "react";

import type { LayoutPoint } from "@core/layout/types";
import type { Edge, EdgeMovementRule } from "@entities/edge/types";
import { getReadableTextColor } from "../canvasLuminance";

type MetadataTooltip = "notes" | "tags";

const EDGE_BADGE_FILL_COLOR = "#ffffff";

function movementIcon(rule: EdgeMovementRule) {
  return rule === "blocked"
    ? { Icon: Ban, label: "Blocked" }
    : rule === "skillCheck"
      ? { Icon: Dices, label: "Skill check" }
      : { Icon: ChevronsDown, label: "Difficult" };
}

function EdgeMetadataTooltip({ edge, point, type, edgeColor }: {
  edge: Edge;
  edgeColor: string;
  point: LayoutPoint;
  type: MetadataTooltip;
}) {
  const pillTextColor = edgeColor === "#ffffff" ? "#111827" : "#ffffff";
  return (
    <foreignObject
      aria-label={`${type === "tags" ? "Tags" : "Notes"} tooltip`}
      height="120"
      overflow="visible"
      role="tooltip"
      width="240"
      x={point.x - 120}
      y={point.y + 14}
    >
      <div className="pointer-events-none mx-auto w-fit max-w-56 rounded-full border border-canvas-line bg-canvas-surface p-1.5 text-canvas-ink text-[10px] shadow-lg">
        {type === "tags" ? (
          <div className="flex flex-wrap gap-2">
            {edge.interactionTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-1.5 py-0.5 font-medium leading-none outline"
                style={{ backgroundColor: edgeColor, color: pillTextColor, outlineWidth: "2px" }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : <p className="mx-auto w-fit max-w-52 whitespace-pre-wrap break-words">{edge.notes}</p>}
      </div>
    </foreignObject>
  );
}

/** Renders compact rule and metadata affordances away from Edge endpoints. */
export function EdgeBadges({ edge, edgeColor, point }: {
  edge: Edge;
  edgeColor: string;
  point: LayoutPoint;
}) {
  const [tooltip, setTooltip] = useState<MetadataTooltip | null>(null);
  const visibility = edge.visibilityRule === "obscured"
    ? { Icon: EyeDashed, label: "Obscured" }
    : edge.visibilityRule === "hidden"
      ? { Icon: EyeOff, label: "Hidden" }
      : undefined;
  const icons = [
    ...(visibility ? [{ ...visibility, tooltip: undefined }] : []),
    ...edge.movementRules.map((rule) => ({ ...movementIcon(rule), tooltip: undefined })),
    ...(edge.interactionTags.length ? [{ Icon: Tag, label: "Tags", tooltip: "tags" as const }] : []),
    ...(edge.notes?.trim() ? [{ Icon: Info, label: "Notes", tooltip: "notes" as const }] : [])
  ];
  if (icons.length === 0) return null;
  const width = icons.length * 18 + 6;
  const iconColor = getReadableTextColor(EDGE_BADGE_FILL_COLOR);

  return (
    <g aria-label={`${edge.visibilityRule} visibility${edge.movementRules.length ? `; ${edge.movementRules.join(", ")}` : ""}`}>
      <rect className="pointer-events-none" fill={EDGE_BADGE_FILL_COLOR} height="20" opacity="0.9" rx="10" width={width} x={point.x - width / 2} y={point.y - 10} />
      {icons.map(({ Icon, label, tooltip: iconTooltip }, index) => (
        <g
          key={label}
          aria-label={label}
          className="pointer-events-auto"
          data-edge-badge-icon="true"
          data-entity-id={edge.id}
          data-entity-type="edge"
          onBlur={() => iconTooltip && setTooltip(null)}
          onFocus={() => iconTooltip && setTooltip(iconTooltip)}
          onPointerEnter={() => iconTooltip && setTooltip(iconTooltip)}
          onPointerLeave={() => iconTooltip && setTooltip(null)}
          tabIndex={iconTooltip ? 0 : undefined}
        >
          <title>{label}</title>
          <rect
            data-edge-badge-hit-target="true"
            fill="transparent"
            height={20}
            width={18}
            x={point.x - (icons.length * 18) / 2 + index * 18 - 2}
            y={point.y - 10}
          />
          <Icon
            aria-hidden="true"
            color={iconColor}
            height={14}
            width={14}
            x={point.x - (icons.length * 18) / 2 + index * 18}
            y={point.y - 7}
          />
        </g>
      ))}
      {tooltip ? <EdgeMetadataTooltip edge={edge} edgeColor={edgeColor} point={point} type={tooltip} /> : null}
    </g>
  );
}
