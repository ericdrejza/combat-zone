import { useState } from "react";

import { calculateZoneLayout } from "../../core/layout/encounterLayout";
import { ZoneColorSection } from "./zoneProperties/ZoneColorSection";
import { ZoneDeleteButton } from "./zoneProperties/ZoneDeleteButton";
import { ZoneLayoutDescriptor } from "./zoneProperties/ZoneLayoutDescriptor";
import { ZoneLayoutSection } from "./zoneProperties/ZoneLayoutSection";
import { ZoneNameSection } from "./zoneProperties/ZoneNameSection";
import { ZonePropertiesHeaderActions } from "./zoneProperties/ZonePropertiesHeaderActions";
import { ZoneTagsSection } from "./zoneProperties/ZoneTagsSection";
import { useZonePropertiesActions } from "./zoneProperties/useZonePropertiesActions";

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
      <ZoneColorSection
        colorSectionOpen={colorSectionOpen}
        onActivateZonePaintBrush={activateZonePaintBrush}
        onCommitZoneProperties={commitZoneProperties}
        onToggleColorSection={() => setColorSectionOpen((isOpen) => !isOpen)}
        zone={selectedZone}
        zonePaintBrush={zonePaintBrush}
      />
      <ZoneLayoutSection
        onCommitZoneProperties={commitZoneProperties}
        zone={selectedZone}
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
