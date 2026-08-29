import { Circle, Paintbrush, Plus, Square } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createPortal } from "react-dom";

import type {
  ActorLayoutGroup,
  ActorShape,
  ActorSize
} from "@entities/actor/types";
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
import { TouchSelectionToggle } from "../TouchSelectionToggle";

type ActorToolButtonProps = {
  activeToolId: ToolId;
  compactLayout: boolean;
  compactSubtoolHost: HTMLDivElement | null;
  onSelected: () => void;
  tool: ToolDefinition;
};

type TokenSizeIconProps = SVGProps<SVGSVGElement>;

const FACTION_OPTIONS: Array<{
  label: string;
  keybind: string;
  title: string;
  value: ActorLayoutGroup;
}> = [
  { keybind: "1", label: "Hero faction", title: "Hero", value: "hero" },
  { keybind: "2", label: "Neutral faction", title: "Neutral", value: "neutral" },
  { keybind: "3", label: "Enemy faction", title: "Enemy", value: "enemy" }
];

const SIZE_OPTIONS: Array<{
  Icon: ComponentType<TokenSizeIconProps>;
  keybind: string;
  label: string;
  title: string;
  value: ActorSize;
}> = [
  {
    Icon: SmallTokenIcon,
    keybind: "4",
    label: "Small actor size",
    title: "Small",
    value: "small"
  },
  {
    Icon: MediumTokenIcon,
    keybind: "5",
    label: "Medium actor size",
    title: "Medium",
    value: "medium"
  },
  {
    Icon: LargeTokenIcon,
    keybind: "6",
    label: "Large actor size",
    title: "Large",
    value: "large"
  },
  {
    Icon: XLargeTokenIcon,
    keybind: "7",
    label: "X-large actor size",
    title: "Huge",
    value: "xLarge"
  }
];

const SHAPE_OPTIONS: Array<{
  Icon: typeof Circle;
  keybind: string;
  label: string;
  title: string;
  value: ActorShape;
}> = [
  {
    Icon: Circle,
    keybind: "8",
    label: "Circle actor shape",
    title: "Circle",
    value: "circle"
  },
  {
    Icon: Square,
    keybind: "9",
    label: "Rectangle actor shape",
    title: "Rectangle",
    value: "rectangle"
  }
];

function SmallTokenIcon(props: TokenSizeIconProps) {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      <rect fill="currentColor" height="8" rx="1.5" width="8" x="6" y="6" />
    </svg>
  );
}

function MediumTokenIcon(props: TokenSizeIconProps) {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      <rect fill="currentColor" height="12" rx="2" width="12" x="4" y="4" />
    </svg>
  );
}

function LargeTokenIcon(props: TokenSizeIconProps) {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      {[4, 10].flatMap((x) =>
        [4, 10].map((y) => (
          <rect
            fill="currentColor"
            height="5"
            key={`${x}-${y}`}
            rx="1"
            width="5"
            x={x}
            y={y}
          />
        ))
      )}
    </svg>
  );
}

function XLargeTokenIcon(props: TokenSizeIconProps) {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      {[3, 8, 13].flatMap((x) =>
        [3, 8, 13].map((y) => (
          <rect
            fill="currentColor"
            height="4"
            key={`${x}-${y}`}
            rx="0.75"
            width="4"
            x={x}
            y={y}
          />
        ))
      )}
    </svg>
  );
}

export function ActorToolButton({
  activeToolId,
  compactLayout,
  compactSubtoolHost,
  onSelected,
  tool
}: ActorToolButtonProps) {
  const dispatch = useDispatch();
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const actorPaintBrush = useSelector(
    (state: RootState) => state.interaction.actorPaintBrush
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);

  function renderOptions() {
    return (
      <>
        <ToolbarOptionGroup aria-label="Actor faction" role="group">
          {FACTION_OPTIONS.map((option) => (
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
          {SIZE_OPTIONS.map(({ Icon, keybind, label, title, value }) => (
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
          {SHAPE_OPTIONS.map(({ Icon, keybind, label, title, value }) => (
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
            onClick={() => setCreateModalOpen(true)}
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
      <TouchSelectionToggle toolId="actor" />
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
        <ActorCreationModal onClose={() => setCreateModalOpen(false)} />
      ) : null}
    </>
  );
}
