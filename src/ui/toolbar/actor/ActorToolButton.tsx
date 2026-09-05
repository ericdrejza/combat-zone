import { Circle, Paintbrush, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createPortal } from "react-dom";

import type { ActorImageInput } from "@entities/actor/actorMutations";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import {
  setActorToolLayoutGroup,
  setActorToolShape,
  setActorToolSize,
  toggleActorPaintBrush
} from "@interaction/interactionState";
import type { ToolDefinition, ToolId } from "@interaction/tools/toolRegistry";
import type { RootState } from "@store/store";
import { ToolButton } from "../ToolButton";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup,
  ToolbarOptionKeybind,
  ToolbarOptionRow,
  ToolbarSubtoolBar
} from "../ToolbarOption";
import { ActorCreationModal } from "./ActorCreationModal";
import {
  ACTOR_FACTION_OPTIONS,
  ACTOR_SHAPE_OPTIONS,
  ACTOR_SIZE_OPTIONS
} from "./actorOptionMetadata";

type ActorToolButtonProps = {
  actorCreationImage?: ActorImageInput | null;
  activeToolId: ToolId;
  compactLayout: boolean;
  compactSubtoolHost: HTMLDivElement | null;
  onOpenLibrary: () => void;
  onSelected: () => void;
  onActorCreationImageHandled?: () => void;
  tool: ToolDefinition;
};

export function ActorToolButton({
  actorCreationImage = null,
  activeToolId,
  compactLayout,
  compactSubtoolHost,
  onOpenLibrary,
  onSelected,
  onActorCreationImageHandled,
  tool
}: ActorToolButtonProps) {
  const dispatch = useDispatch();
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const actorPaintBrush = useSelector(
    (state: RootState) => state.interaction.actorPaintBrush
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalImage, setCreateModalImage] =
    useState<ActorImageInput | null>(null);

  useEffect(() => {
    if (!actorCreationImage) {
      return;
    }

    setCreateModalImage(actorCreationImage);
    setCreateModalOpen(true);
    onActorCreationImageHandled?.();
  }, [actorCreationImage, onActorCreationImageHandled]);

  function openCreateModal() {
    setCreateModalImage(null);
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    setCreateModalImage(null);
    setCreateModalOpen(false);
  }

  function openLibraryForActorImage() {
    closeCreateModal();
    onOpenLibrary();
  }

  function renderOptions() {
    return (
      <>
        <ToolbarOptionGroup aria-label="Actor faction" role="group">
          {ACTOR_FACTION_OPTIONS.map((option) => (
            <ToolbarOptionButton
              key={option.value}
              aria-label={option.label}
              aria-pressed={actorTool.layoutGroup === option.value}
              active={actorTool.layoutGroup === option.value}
              onClick={() => dispatch(setActorToolLayoutGroup(option.value))}
              title={option.title}
              type="button"
            >
              <Circle
                aria-hidden="true"
                className={`h-4 w-4 fill-current ${
                  ACTOR_LAYOUT_GROUP_COLORS[option.value].iconClassName
                }`}
              />
              <ToolbarOptionKeybind active={actorTool.layoutGroup === option.value}>
                {option.keybind}
              </ToolbarOptionKeybind>
            </ToolbarOptionButton>
          ))}
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Actor size" role="group">
          {ACTOR_SIZE_OPTIONS.map(({ Icon, keybind, label, title, value }) => (
            <ToolbarOptionButton
              key={value}
              aria-label={label}
              aria-pressed={actorTool.size === value}
              active={actorTool.size === value}
              onClick={() => dispatch(setActorToolSize(value))}
              title={title}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4 fill-current" />
              <ToolbarOptionKeybind active={actorTool.size === value}>
                {keybind}
              </ToolbarOptionKeybind>
            </ToolbarOptionButton>
          ))}
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Actor shape" role="group">
          {ACTOR_SHAPE_OPTIONS.map(({ Icon, keybind, label, title, value }) => (
            <ToolbarOptionButton
              key={value}
              aria-label={label}
              aria-pressed={actorTool.shape === value}
              active={actorTool.shape === value}
              onClick={() => dispatch(setActorToolShape(value))}
              title={title}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4 fill-current" />
              <ToolbarOptionKeybind active={actorTool.shape === value}>
                {keybind}
              </ToolbarOptionKeybind>
            </ToolbarOptionButton>
          ))}
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Create Actor" role="group">
          <ToolbarOptionButton
            aria-label="Create actor"
            className="w-11 min-w-0 px-0 lg:w-8"
            onClick={openCreateModal}
            title="Create actor"
            type="button"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Actor paint" role="group">
          <ToolbarOptionButton
            aria-label="Paint actors"
            aria-pressed={actorPaintBrush}
            active={actorPaintBrush}
            onClick={() => dispatch(toggleActorPaintBrush())}
            title="Paint"
            type="button"
          >
            <Paintbrush aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
        </ToolbarOptionGroup>
      </>
    );
  }

  const optionBar = activeToolId === "actor" ? (
    <ToolbarSubtoolBar aria-label="Actor options">
      {renderOptions()}
    </ToolbarSubtoolBar>
  ) : null;

  return (
    <>
      <ToolbarOptionRow className="max-lg:contents">
        <ToolButton
          activeToolId={activeToolId}
          onSelected={onSelected}
          tool={tool}
        />
        {!compactLayout ? optionBar : null}
      </ToolbarOptionRow>
      {compactLayout && compactSubtoolHost && optionBar
        ? createPortal(optionBar, compactSubtoolHost)
        : null}
      {createModalOpen ? (
        <ActorCreationModal
          initialImage={createModalImage}
          onClose={closeCreateModal}
          onOpenLibrary={openLibraryForActorImage}
        />
      ) : null}
    </>
  );
}
