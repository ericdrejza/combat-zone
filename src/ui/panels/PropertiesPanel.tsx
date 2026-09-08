import { useSelector } from "react-redux";

import type { LibrarySectionId } from "@library/types";
import type { RootState } from "@store/store";
import { ActorPropertiesPanel } from "./ActorPropertiesPanel";
import { BackgroundPropertiesPanel } from "./BackgroundPropertiesPanel";
import { EdgePropertiesPanel } from "./EdgePropertiesPanel";
import { EngagementPropertiesPanel } from "./EngagementPropertiesPanel";
import { ZonePropertiesPanel } from "./ZonePropertiesPanel";

export type PropertiesLibraryLocation = {
  folderId: string;
  nodeId?: string;
  sectionId: LibrarySectionId;
};

type PropertiesPanelProps = {
  onOpenLibraryLocation?: (location: PropertiesLibraryLocation) => void;
  onOpenTokenLibraryForActor?: (
    actorId: string,
    location?: PropertiesLibraryLocation
  ) => void;
};

export function PropertiesPanel({
  onOpenLibraryLocation,
  onOpenTokenLibraryForActor
}: PropertiesPanelProps) {
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );

  if (activeToolId === "background") {
    return (
      <BackgroundPropertiesPanel
        onOpenLibraryLocation={onOpenLibraryLocation}
      />
    );
  }

  if (selection.selectedEntityType === "actor") {
    return (
      <ActorPropertiesPanel
        onOpenTokenLibrary={(location) =>
          onOpenTokenLibraryForActor?.(
            selection.selectedIds[0] as string,
            location
          )
        }
      />
    );
  }

  if (selection.selectedEntityType === "engagement") {
    return <EngagementPropertiesPanel />;
  }

  if (selection.selectedEntityType === "edge") {
    return <EdgePropertiesPanel />;
  }

  return <ZonePropertiesPanel />;
}
