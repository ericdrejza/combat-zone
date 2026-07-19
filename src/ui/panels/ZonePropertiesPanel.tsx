import { useState } from "react";

import { calculateZoneLayout } from "@core/layout/encounterLayout";
import { ZoneColorSection } from "./zone_properties/ZoneColorSection";
import { ZoneDeleteButton } from "./zone_properties/ZoneDeleteButton";
import { ZoneLayoutDescriptor } from "./zone_properties/ZoneLayoutDescriptor";
import { ZoneLayoutSection } from "./zone_properties/ZoneLayoutSection";
import { ZoneNameSection } from "./zone_properties/ZoneNameSection";
import { ZonePropertiesHeaderActions } from "./zone_properties/ZonePropertiesHeaderActions";
import { ZoneTagsSection } from "./zone_properties/ZoneTagsSection";
import { useZonePropertiesActions } from "./zone_properties/useZonePropertiesActions";

export { ZonePropertiesHeaderActions };

export function ZonePropertiesPanel() {
  const [colorSectionOpen, setColorSectionOpen] = useState(true);
  const {
    activateZonePaintBrush,
    commitZoneDelete,
    commitZoneProperties,
    encounter,
    selectedZone,
    zonePaintBrush
  } = useZonePropertiesActions();

  if (!selectedZone) {
    return (
      <p className="text-sm text-canvas-muted">
        Select a zone to edit its name, layout strategy, tags, and deletion.
      </p>
    );
  }

  const layoutDescriptor = calculateZoneLayout(encounter, selectedZone.id).descriptor;

  return (
    <div key={selectedZone.id} className="space-y-4 text-sm">
      <ZoneNameSection
        onCommitZoneProperties={commitZoneProperties}
        zone={selectedZone}
      />
      <ZoneLayoutSection
        onCommitZoneProperties={commitZoneProperties}
        zone={selectedZone}
      />
      <ZoneColorSection
        colorSectionOpen={colorSectionOpen}
        onActivateZonePaintBrush={activateZonePaintBrush}
        onCommitZoneProperties={commitZoneProperties}
        onToggleColorSection={() => setColorSectionOpen((isOpen) => !isOpen)}
        zone={selectedZone}
        zonePaintBrush={zonePaintBrush}
      />
      <ZoneTagsSection
        onCommitZoneProperties={commitZoneProperties}
        zone={selectedZone}
      />
      <ZoneLayoutDescriptor descriptor={layoutDescriptor} />
      <ZoneDeleteButton onDeleteZone={commitZoneDelete} />
    </div>
  );
}
