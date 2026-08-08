import type { SelectableEntityType } from "../selection/types";

export type ToolId =
  | "select"
  | "zone"
  | "edge"
  | "actor"
  | "annotation"
  | "background";

export type ToolInteractionContract = {
  selectableEntityTypes: SelectableEntityType[];
  dragBehavior: string;
  clickBehavior: string;
  keyboardShortcut: string;
};

export type ToolDefinition = {
  id: ToolId;
  label: string;
  tooltip: string;
  contract: ToolInteractionContract;
};

export const MVP_TOOLS: ToolDefinition[] = [
  {
    id: "select",
    label: "Select",
    tooltip: "Select and inspect entities.",
    contract: {
      selectableEntityTypes: ["zone", "edge", "actor", "engagement", "annotation"],
      dragBehavior: "Move selected entities or box select when dragging empty canvas.",
      clickBehavior: "Select an entity, ctrl-click to toggle one item, or ctrl-a to select all zones.",
      keyboardShortcut: "v"
    }
  },
  {
    id: "zone",
    label: "Zone",
    tooltip: "Draw and edit polygonal zones.",
    contract: {
      selectableEntityTypes: ["zone"],
      dragBehavior: "Edit selected zone geometry or box select zones.",
      clickBehavior: "Select zones, ctrl-click to toggle one zone, or ctrl-a to select all zones.",
      keyboardShortcut: "z"
    }
  },
  {
    id: "edge",
    label: "Edge",
    tooltip: "Create directional zone relationships.",
    contract: {
      selectableEntityTypes: ["edge"],
      dragBehavior: "Drag from a source zone to a target zone to create or replace an edge.",
      clickBehavior: "Select an edge for inspection and editable properties.",
      keyboardShortcut: "e"
    }
  },
  {
    id: "actor",
    label: "Actor",
    tooltip: "Place and move actors.",
    contract: {
      selectableEntityTypes: ["actor", "engagement"],
      dragBehavior: "Move actors between zones or engagements in later roadmap work.",
      clickBehavior: "Select actors before actor placement behavior is implemented.",
      keyboardShortcut: "a"
    }
  },
  {
    id: "annotation",
    label: "Annotation",
    tooltip: "Add notes, arrows, and markers.",
    contract: {
      selectableEntityTypes: ["annotation"],
      dragBehavior: "Place or adjust annotations in later roadmap work.",
      clickBehavior: "Select annotations before annotation creation behavior is implemented.",
      keyboardShortcut: "n"
    }
  },
  {
    id: "background",
    label: "Background",
    tooltip: "Add, replace, or delete the canvas background image.",
    contract: {
      selectableEntityTypes: [],
      dragBehavior: "Accept native image drops to add or replace the canvas background.",
      clickBehavior: "Open background image actions.",
      keyboardShortcut: "b"
    }
  }
];

export const TOOL_DEFINITIONS_BY_ID: Record<ToolId, ToolDefinition> =
  Object.fromEntries(MVP_TOOLS.map((tool) => [tool.id, tool])) as Record<
    ToolId,
    ToolDefinition
  >;

export function canToolSelectEntityType(
  toolId: ToolId,
  entityType: SelectableEntityType
): boolean {
  return TOOL_DEFINITIONS_BY_ID[toolId].contract.selectableEntityTypes.includes(
    entityType
  );
}
