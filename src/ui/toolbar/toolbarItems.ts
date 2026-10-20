import {
  Grid3X3,
  Ruler,
  ArrowRightFromLine,
  AudioLines,
  Bookmark,
  CircleUserRound,
  Circle,
  Hexagon,
  Image,
  Pointer,
  VectorPolygon,
  Square,
  Shapes,
  type LucideIcon
} from 'lucide-react';

import type { ZoneShape } from '@entities/zone/types';
import {
  TOOL_DEFINITIONS_BY_ID,
  type ToolDefinition
} from '@interaction/tools/toolRegistry';
import type { ToolId } from '@interaction/tools/toolRegistry';

/** Primary tool iconography stays centralized so compact and desktop controls match. */
export const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  audio: AudioLines,
  actor: CircleUserRound,
  annotation: Bookmark,
  background: Image,
  edge: ArrowRightFromLine,
  select: Pointer,
  grid: Grid3X3,
  ruler: Ruler,
  zone: Shapes
};

export type ZoneShapeOption = {
  icon: typeof Square;
  keybind: string;
  label: string;
  shape: ZoneShape;
};

export type ToolbarItem =
  | {
      type: 'tool';
      tool: ToolDefinition;
    }
  | {
      id: string;
      type: 'separator';
    };

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.background },
  { id: 'background-grid', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.grid },
  { id: 'grid-zone', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.zone },
  { id: 'zone-edge', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.edge },
  { id: 'edge-annotation', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.annotation },
  { id: 'annotation-actor', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.actor },
  { id: 'actor-audio', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.audio },
  { id: 'audio-select', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.ruler },
  { id: 'ruler-select', type: 'separator' },
  { type: 'tool', tool: TOOL_DEFINITIONS_BY_ID.select }
];

export const ZONE_SHAPE_OPTIONS: ZoneShapeOption[] = [
  { icon: Square, keybind: '1', label: 'Rectangle', shape: 'rectangle' },
  { icon: Circle, keybind: '2', label: 'Circle', shape: 'circle' },
  { icon: Hexagon, keybind: '3', label: 'Hexagon', shape: 'hexagon' },
  { icon: VectorPolygon, keybind: '4', label: 'Polygon', shape: 'polygon' }
];
