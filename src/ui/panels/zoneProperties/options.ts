import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  type LucideIcon
} from 'lucide-react';

import type { LayoutOrientation } from '../../../core/layout/types';
import type { Zone, ZoneNamePosition } from '../../../entities/zone/types';
import type { UpdateZonePropertiesInput } from '../../../entities/zone/zoneMutations';

export const zoneLayoutStrategies: Zone['layoutStrategy'][] = [
  'FLEX',
  'SEQUENTIAL',
  'SPLIT_FLEX',
  'SPLIT_SEQUENTIAL'
];

export const zoneLayoutOrientations: LayoutOrientation[] = [
  'LEFT_RIGHT',
  'TOP_BOTTOM'
];

export const zoneColorOptions = [
  '#ffffff',
  '#d6d3d1',
  '#AAAAAA',
  '#765341',
  '#92400e',
  '#fef3c7',
  '#fed7aa',
  '#fecaca',
  '#fbcfe8',
  '#ddd6fe',
  '#bfdbfe',
  '#bae6fd',
  '#bbf7d0',
  '#d9f99d',
  '#991b1b',
  '#fde68a',
  '#365314',
  '#047857',
  '#1d4ed8',
  '#6d28d9'
];

export const zoneNamePositions: Array<{
  icon: LucideIcon;
  id: ZoneNamePosition;
  label: string;
}> = [
  { icon: ArrowUpLeft, id: 'top-left', label: 'Top left' },
  { icon: ArrowUpRight, id: 'top-right', label: 'Top right' },
  { icon: ArrowDownLeft, id: 'bottom-left', label: 'Bottom left' },
  { icon: ArrowDownRight, id: 'bottom-right', label: 'Bottom right' }
];

export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function getExportableZoneProperties(
  zone: Zone
): UpdateZonePropertiesInput {
  return {
    colorBorder: zone.colorBorder,
    colorFill: zone.colorFill,
    layoutOrientation: zone.layoutOrientation,
    layoutStrategy: zone.layoutStrategy,
    namePosition: zone.namePosition,
    opacity: zone.opacity,
    showBorder: zone.showBorder,
    showName: zone.showName,
    tags: zone.tags
  };
}

export function isSplitLayoutStrategy(
  strategy: Zone['layoutStrategy']
): boolean {
  return strategy.startsWith('SPLIT_');
}
