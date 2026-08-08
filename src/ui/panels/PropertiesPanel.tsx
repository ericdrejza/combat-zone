import { useSelector } from "react-redux";

import type { RootState } from "@store/store";
import { ActorPropertiesPanel } from "./ActorPropertiesPanel";
import { ZonePropertiesPanel } from "./ZonePropertiesPanel";
import { EngagementPropertiesPanel } from './EngagementPropertiesPanel';
import { EdgePropertiesPanel } from './EdgePropertiesPanel';

export function PropertiesPanel() {
  const selection = useSelector((state: RootState) => state.interaction.selection);

  if (selection.selectedEntityType === "actor") {
    return <ActorPropertiesPanel />;
  }

  if (selection.selectedEntityType === 'engagement') {
    return <EngagementPropertiesPanel />;
  }

  if (selection.selectedEntityType === 'edge') {
    return <EdgePropertiesPanel />;
  }

  return <ZonePropertiesPanel />;
}
