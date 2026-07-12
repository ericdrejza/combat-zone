import { Circle, Hexagon, Pentagon, Square } from "lucide-react";

import type { ZoneShape } from "../../entities/zone/types";
import {
  TOOL_DEFINITIONS_BY_ID,
  type ToolDefinition
} from "../../interaction/tools/toolRegistry";

export type ZoneShapeOption = {
  icon: typeof Square;
  keybind: string;
  label: string;
  shape: ZoneShape;
};

export type ToolbarItem =
  | {
      type: "tool";
      tool: ToolDefinition;
    }
  | {
      id: string;
      type: "separator";
    };

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.background },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.zone },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.edge },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.annotation },
  { id: "annotation-actor", type: "separator" },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.actor },
  { id: "actor-select", type: "separator" },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.select }
];

export const ZONE_SHAPE_OPTIONS: ZoneShapeOption[] = [
  { icon: Square, keybind: "1", label: "Rectangle", shape: "rectangle" },
  { icon: Circle, keybind: "2", label: "Circle", shape: "circle" },
  { icon: Hexagon, keybind: "3", label: "Hexagon", shape: "hexagon" },
  { icon: Pentagon, keybind: "4", label: "Polygon", shape: "polygon" }
];
