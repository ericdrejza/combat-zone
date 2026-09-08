import { BookOpen, Link2 } from "lucide-react";
import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { ActorType } from "@entities/actor/types";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { updateActorProperties } from "@entities/actor/actorMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";
import { useZoneResizeApproval } from "../zoneResizeApproval";
import { getLibraryNodePath } from "@library/librarySlice";
import { ActorPropertyOptionGroups } from "./ActorPropertyOptionGroups";

type ActorPropertiesPanelProps = {
  onOpenTokenLibrary?: () => void;
};

const ACTOR_TYPES: ActorType[] = [
  "creature",
  "object",
  "objective",
  "pointOfInterest"
];

export function ActorPropertiesPanel({
  onOpenTokenLibrary
}: ActorPropertiesPanelProps) {
  const dispatch = useDispatch();
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const { requestApproval } = useZoneResizeApproval();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const selectedActorId =
    selection.selectedEntityType === "actor" ? selection.selectedIds[0] : undefined;
  const actor = selectedActorId ? encounter.actors.byId[selectedActorId] : undefined;
  const tokens = useSelector((state: RootState) => state.library.sections.tokens);

  if (!actor) {
    return (
      <p className="text-sm text-canvas-muted">
        Select an actor to edit its name, type, faction, image, and size.
      </p>
    );
  }

  function commitActorProperties(
    properties: Parameters<typeof updateActorProperties>[2]
  ) {
    if (!actor) {
      return;
    }

    const nextEncounter = updateActorProperties(
      encounter,
      actor.id,
      properties
    );

    if (nextEncounter === encounter) {
      return;
    }

    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("actor.updateProperties", {
        actorId: actor.id,
        properties
      }),
      currentEncounter: encounter,
      nextEncounter
    });

    const commitPreparedChange = (resolved: Awaited<typeof prepared>) => {
      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
    };

    const handlePrepared = (resolved: Awaited<typeof prepared>) => {
      if (logEncounterValidationBlock(dispatch, resolved)) {
        return;
      }
      if (resolved.requiresConfirmation) {
        requestApproval({ onApprove: () => commitPreparedChange(resolved) });
        return;
      }

      if (!resolved.blocked) {
        commitPreparedChange(resolved);
      }
    };

    if (prepared instanceof Promise) {
      void prepared.then(handlePrepared);
    } else {
      handlePrepared(prepared);
    }
  }

  const libraryNodeId = typeof actor.metadata.sourceLibraryNodeId === "string"
    ? actor.metadata.sourceLibraryNodeId
    : null;
  const tokenPath = libraryNodeId
    ? getLibraryNodePath(tokens, libraryNodeId)
    : null;
  const webImageUrl = actor.image?.kind === "url" ? actor.image.url : "";

  function activateWebImageSource() {
    commitActorProperties({
      image: webImageUrl ? { kind: "url", url: webImageUrl } : undefined,
      imageLibraryNodeId: null
    });
    queueMicrotask(() => {
      tokenInputRef.current?.focus();
      tokenInputRef.current?.select();
    });
  }

  return (
    <div key={actor.id} className="space-y-3 text-sm">
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Name</span>
        <input
          className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-1.5 text-canvas-ink"
          onBlur={(event) =>
            commitActorProperties({ name: event.currentTarget.value.trim() })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          type="text"
          defaultValue={actor.name}
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="font-semibold text-canvas-ink">Type</span>
        <select
          className="min-w-0 flex-1 rounded-xl border border-canvas-line bg-canvas-surface px-2 py-1.5 text-canvas-ink"
          onChange={(event) =>
            commitActorProperties({ actorType: event.currentTarget.value as ActorType })
          }
          value={actor.actorType}
        >
          {ACTOR_TYPES.map((actorType) => (
            <option key={actorType} value={actorType}>
              {actorType}
            </option>
          ))}
        </select>
      </label>
      <ActorPropertyOptionGroups actor={actor} onChange={commitActorProperties} />
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-canvas-ink">
            {tokenPath ? "Token Path" : "Token image URL"}
          </span>
          <div className="flex items-center gap-1">
            <button
              aria-label="Choose actor image from library"
              aria-pressed={Boolean(tokenPath)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                tokenPath
                  ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
                  : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"
              }`}
              onClick={onOpenTokenLibrary}
              title="Choose actor image from library"
              type="button"
            >
              <BookOpen aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              aria-label="Use web link for actor image"
              aria-pressed={!tokenPath}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                tokenPath
                  ? "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"
                  : "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
              }`}
              onClick={activateWebImageSource}
              title="Use web link for actor image"
              type="button"
            >
              <Link2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <input
          key={`${actor.id}:${tokenPath ? "library" : "url"}:${tokenPath ?? webImageUrl}`}
          ref={tokenInputRef}
          aria-label={tokenPath ? "Token Path" : "Token image URL"}
          className={`w-full rounded-xl border border-canvas-line px-3 py-1.5 text-canvas-ink ${
            tokenPath ? "bg-canvas" : "bg-canvas-surface"
          }`}
          onBlur={(event) => {
            if (tokenPath) return;
            commitActorProperties({
              image: event.currentTarget.value.trim()
                ? { kind: "url", url: event.currentTarget.value.trim() }
                : undefined,
              imageLibraryNodeId: null
            });
          }}
          onClick={(event) => {
            if (!tokenPath) event.currentTarget.select();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !tokenPath) event.currentTarget.blur();
          }}
          readOnly={Boolean(tokenPath)}
          type="text"
          defaultValue={tokenPath ?? webImageUrl}
        />
      </div>
    </div>
  );
}
