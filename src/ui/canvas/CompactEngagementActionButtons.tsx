import type { EncounterState } from "@core/encounter/types";
import { getActorEngagement } from "@core/encounter/inspectors";
import { canEngageSelectedActors } from "@entities/engagement/engagementMutations";
import type { SelectionState } from "@interaction/selection/types";
import type { ToolId } from "@interaction/tools/toolRegistry";
import { DisengageActionButton } from "@ui/toolbar/DisengageActionButton";
import { EngageActionButton } from "@ui/toolbar/EngageActionButton";

type CompactEngagementActionButtonsProps = {
  activeToolId: ToolId;
  encounter: EncounterState;
  selection: SelectionState;
};

/** Shows engagement actions only for actor selections on the Actor or Select tool. */
export function CompactEngagementActionButtons({
  activeToolId,
  encounter,
  selection
}: CompactEngagementActionButtonsProps) {
  if (
    (activeToolId !== "actor" && activeToolId !== "select") ||
    selection.selectedEntityType !== "actor"
  ) {
    return null;
  }

  const selectedActorIds = selection.selectedIds;
  const showEngage = canEngageSelectedActors(encounter, selectedActorIds);
  const showDisengage = selectedActorIds.some((actorId) =>
    Boolean(getActorEngagement(encounter, actorId))
  );

  if (!showEngage && !showDisengage) return null;

  return (
    <>
      {showEngage ? <EngageActionButton compact /> : null}
      {showDisengage ? <DisengageActionButton compact /> : null}
    </>
  );
}
