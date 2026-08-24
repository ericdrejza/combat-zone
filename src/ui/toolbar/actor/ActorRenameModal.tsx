import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { updateActorProperties } from "@entities/actor/actorMutations";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { RenameModal } from "@ui/RenameModal";

type ActorRenameModalProps = {
  onClose: () => void;
};

export function ActorRenameModal({ onClose }: ActorRenameModalProps) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const actorIds =
    selection.selectedEntityType === "actor" ? selection.selectedIds : [];

  function rename(nextName: string) {
    const nextEncounter = actorIds.reduce(
      (currentEncounter, actorId) =>
        updateActorProperties(currentEncounter, actorId, { name: nextName }),
      encounter
    );

    if (nextEncounter !== encounter) {
      dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("actor.renameMany", {
            actorIds,
            name: nextName
          }),
          nextEncounter
        })
      );
    }
  }

  return (
    <RenameModal
      ariaLabel="Rename actors"
      inputLabel="New actor name"
      onClose={onClose}
      onRename={rename}
      title="Rename actors"
    />
  );
}
