import type { Zone } from "@entities/zone/types";
import type {
  CreateZoneInput,
  UpdateZonePropertiesInput
} from "@entities/zone/zoneMutations";

export function getPaintableZoneProperties(
  zone: Zone
): UpdateZonePropertiesInput {
  return {
    colorBorder: zone.colorBorder,
    colorEngagement: zone.colorEngagement,
    colorFill: zone.colorFill,
    matchEngagementColorToBorder: zone.matchEngagementColorToBorder,
    opacity: zone.opacity,
    showBorder: zone.showBorder
  };
}

export function getCloneableZoneProperties(zone: Zone): Pick<
  CreateZoneInput,
  | "autoResize"
  | "colorBorder"
  | "colorEngagement"
  | "colorFill"
  | "layoutOrientation"
  | "layoutStrategy"
  | "matchEngagementColorToBorder"
  | "namePosition"
  | "opacity"
  | "showBorder"
  | "showName"
  | "showSectionDividers"
  | "tags"
> {
  return {
    autoResize: zone.autoResize,
    colorBorder: zone.colorBorder,
    colorEngagement: zone.colorEngagement,
    colorFill: zone.colorFill,
    layoutOrientation: zone.layoutOrientation,
    layoutStrategy: zone.layoutStrategy,
    matchEngagementColorToBorder: zone.matchEngagementColorToBorder,
    namePosition: zone.namePosition,
    opacity: zone.opacity,
    showBorder: zone.showBorder,
    showName: zone.showName,
    showSectionDividers: zone.showSectionDividers,
    tags: zone.tags
  };
}
