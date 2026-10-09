import { useSelector } from "react-redux";

import type { LibrarySectionId } from "@library/types";
import type { RootState } from "@store/store";
import { ActorPropertiesPanel } from "./ActorPropertiesPanel";
import { BackgroundPropertiesPanel } from "./BackgroundPropertiesPanel";
import { EdgePropertiesPanel } from "./EdgePropertiesPanel";
import { EngagementPropertiesPanel } from "./EngagementPropertiesPanel";
import { ZonePropertiesPanel } from "./ZonePropertiesPanel";
import { AudioPropertiesPanel } from "./AudioPropertiesPanel";

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
  const movementStrategy = useSelector((state: RootState) => state.encounter.present.movementStrategy);
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

  if (activeToolId === "audio") return <AudioPropertiesPanel />;

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

  if (movementStrategy !== "zone") return <p className="text-sm text-canvas-muted">Select an actor to edit its properties.</p>;
  return <ZonePropertiesPanel />;
}
