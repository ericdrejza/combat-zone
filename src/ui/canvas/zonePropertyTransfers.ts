import type { Zone } from "../../entities/zone/types";
import type {
  CreateZoneInput,
  UpdateZonePropertiesInput
} from "../../entities/zone/zoneMutations";

export function getPaintableZoneProperties(
  zone: Zone
): UpdateZonePropertiesInput {
  return {
    colorBorder: zone.colorBorder,
    colorFill: zone.colorFill,
    opacity: zone.opacity,
    showBorder: zone.showBorder
  };
}

export function getCloneableZoneProperties(zone: Zone): Pick<
  CreateZoneInput,
  | "colorBorder"
  | "colorFill"
  | "layoutOrientation"
  | "layoutStrategy"
  | "namePosition"
  | "opacity"
  | "showBorder"
  | "showName"
  | "tags"
> {
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
