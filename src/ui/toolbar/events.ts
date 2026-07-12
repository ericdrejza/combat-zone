export const CLOSE_ZONE_SHAPE_MENU_EVENT = "combat-zone:close-zone-shape-menu";

export function closeZoneShapeMenu() {
  window.dispatchEvent(new Event(CLOSE_ZONE_SHAPE_MENU_EVENT));
}
