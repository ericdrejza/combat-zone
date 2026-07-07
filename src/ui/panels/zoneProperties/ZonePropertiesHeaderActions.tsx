import { Upload } from "lucide-react";

import { useZonePropertiesActions } from "./useZonePropertiesActions";

export function ZonePropertiesHeaderActions() {
  const {
    exportSourcePropertiesToSelection,
    selectedZone,
    selectedZoneIds
  } = useZonePropertiesActions();

  if (!selectedZone || selectedZoneIds.length < 2) {
    return null;
  }

  return (
    <button
      aria-label="Export first selected zone properties"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-muted transition hover:bg-canvas"
      onClick={exportSourcePropertiesToSelection}
      title="Export first selected zone properties"
      type="button"
    >
      <Upload aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
