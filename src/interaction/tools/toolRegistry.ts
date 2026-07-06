export type ToolId =
  | "select"
  | "zone"
  | "edge"
  | "actor"
  | "engagement"
  | "annotation"
  | "delete"
  | "pan";

export type ToolDefinition = {
  id: ToolId;
  label: string;
  tooltip: string;
};

export const MVP_TOOLS: ToolDefinition[] = [
  { id: "select", label: "Select", tooltip: "Select and inspect entities." },
  { id: "zone", label: "Zone", tooltip: "Draw and edit polygonal zones." },
  { id: "edge", label: "Edge", tooltip: "Create directional zone relationships." },
  { id: "actor", label: "Actor", tooltip: "Place and move actors." },
  { id: "engagement", label: "Engagement", tooltip: "Create and manage engagement groups." },
  { id: "annotation", label: "Annotation", tooltip: "Add notes, arrows, and markers." },
  { id: "delete", label: "Delete", tooltip: "Delete selected entities through history-tracked actions." },
  { id: "pan", label: "Pan", tooltip: "Move around the encounter canvas." }
];
