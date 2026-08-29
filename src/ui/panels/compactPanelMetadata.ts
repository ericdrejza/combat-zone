import {
  Activity,
  CircleOff,
  Library,
  ListOrdered,
  ScrollText,
  SlidersHorizontal
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** The stable order used by the compact panel launcher and its keyboard menu. */
export const COMPACT_PANEL_IDS = [
  "library",
  "properties",
  "log",
  "status",
  "initiative",
  "zoneless"
] as const;

export type CompactPanelId = (typeof COMPACT_PANEL_IDS)[number];

export type CompactPanelDefinition = {
  id: CompactPanelId;
  title: string;
  Icon: LucideIcon;
};

export const COMPACT_PANEL_DEFINITIONS: readonly CompactPanelDefinition[] = [
  { id: "library", title: "Library", Icon: Library },
  { id: "properties", title: "Properties", Icon: SlidersHorizontal },
  { id: "log", title: "Log", Icon: ScrollText },
  { id: "status", title: "Status", Icon: Activity },
  { id: "initiative", title: "Initiative", Icon: ListOrdered },
  { id: "zoneless", title: "Zoneless", Icon: CircleOff }
];

export function getCompactPanelDefinition(
  id: CompactPanelId
): CompactPanelDefinition {
  return COMPACT_PANEL_DEFINITIONS.find((panel) => panel.id === id)!;
}
