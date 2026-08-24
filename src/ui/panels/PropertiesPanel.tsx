import { useSelector } from "react-redux";

import type { RootState } from "@store/store";
import { ActorPropertiesPanel } from "./ActorPropertiesPanel";
import { BackgroundPropertiesPanel } from "./BackgroundPropertiesPanel";
import { EdgePropertiesPanel } from "./EdgePropertiesPanel";
import { EngagementPropertiesPanel } from "./EngagementPropertiesPanel";
import { ZonePropertiesPanel } from "./ZonePropertiesPanel";

export function PropertiesPanel() {
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );

  if (activeToolId === "background") {
    return <BackgroundPropertiesPanel />;
  }

  if (selection.selectedEntityType === "actor") {
    return <ActorPropertiesPanel />;
  }

  if (selection.selectedEntityType === "engagement") {
    return <EngagementPropertiesPanel />;
  }

  if (selection.selectedEntityType === "edge") {
    return <EdgePropertiesPanel />;
  }

  return <ZonePropertiesPanel />;
}
