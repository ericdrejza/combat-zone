import {
  Activity,
  BookOpen,
  CircleOff,
  Library,
  ListOrdered,
  ScrollText,
  SlidersHorizontal
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** The stable order used by the compact panel launcher and its keyboard menu. */
export const COMPACT_PANEL_IDS = [
  'library',
  'properties',
  'log',
  'status',
  'initiative',
  'zoneless'
] as const;

export type CompactPanelId = (typeof COMPACT_PANEL_IDS)[number];

export type CompactPanelDefinition = {
  id: CompactPanelId;
  title: string;
  Icon: LucideIcon;
};

export const COMPACT_PANEL_DEFINITIONS: readonly CompactPanelDefinition[] = [
  { id: 'log', title: 'Log', Icon: ScrollText },
  { id: 'library', title: 'Library', Icon: BookOpen },
  { id: 'zoneless', title: 'Zoneless', Icon: CircleOff },
  { id: 'properties', title: 'Properties', Icon: SlidersHorizontal },
  { id: 'status', title: 'Status', Icon: Activity },
  { id: 'initiative', title: 'Initiative', Icon: ListOrdered }
];

export function getCompactPanelDefinition(
  id: CompactPanelId
): CompactPanelDefinition {
  return COMPACT_PANEL_DEFINITIONS.find((panel) => panel.id === id)!;
}
