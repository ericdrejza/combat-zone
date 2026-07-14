import { Circle, Paintbrush, Plus, Square } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type {
  ActorLayoutGroup,
  ActorShape,
  ActorSize
} from "../../../entities/actor/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "../../../entities/actor/actorVisuals";
import {
  setActorToolLayoutGroup,
  setActorToolShape,
  setActorToolSize,
  toggleActorPaintBrush
} from "../../../interaction/interactionState";
import type { ToolDefinition, ToolId } from "../../../interaction/tools/toolRegistry";
import type { RootState } from "../../../store/store";
import { ToolButton } from "../ToolButton";
import { ActorCreationModal } from "./ActorCreationModal";

type ActorToolButtonProps = {
  activeToolId: ToolId;
  onCloseMenus: () => void;
  onSelected: () => void;
  tool: ToolDefinition;
};

type TokenSizeIconProps = SVGProps<SVGSVGElement>;

const FACTION_OPTIONS: Array<{
  label: string;
  title: string;
  value: ActorLayoutGroup;
}> = [
  { label: "Hero faction", title: "Hero", value: "hero" },
  { label: "Neutral faction", title: "Neutral", value: "neutral" },
  { label: "Enemy faction", title: "Enemy", value: "enemy" }
];

const SIZE_OPTIONS: Array<{
  Icon: ComponentType<TokenSizeIconProps>;
  label: string;
  title: string;
  value: ActorSize;
}> = [
  {
    Icon: SmallTokenIcon,
    label: "Small actor size",
    title: "Small",
    value: "small"
  },
  {
    Icon: MediumTokenIcon,
    label: "Medium actor size",
    title: "Medium",
    value: "medium"
  },
  {
    Icon: LargeTokenIcon,
    label: "Large actor size",
    title: "Large",
    value: "large"
  },
  {
    Icon: XLargeTokenIcon,
    label: "X-large actor size",
    title: "Huge",
    value: "xLarge"
  }
];

const SHAPE_OPTIONS: Array<{
  Icon: typeof Circle;
  label: string;
  title: string;
  value: ActorShape;
}> = [
  {
    Icon: Circle,
    label: "Circle actor shape",
    title: "Circle",
    value: "circle"
  },
  {
    Icon: Square,
    label: "Rectangle actor shape",
    title: "Rectangle",
    value: "rectangle"
  }
];

function optionGroupClassName() {
  return "flex gap-1 rounded-full border border-canvas-line bg-white/75 p-1 shadow-sm";
}

function optionButtonClassName(active: boolean) {
  return `flex h-8 w-8 items-center justify-center rounded-full border transition ${
    active
      ? "border-canvas-ink bg-canvas-ink text-white"
      : "border-canvas-line bg-white text-canvas-muted hover:bg-canvas"
  }`;
}

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
  onCloseMenus,
  onSelected,
  tool
}: ActorToolButtonProps) {
  const dispatch = useDispatch();
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const actorPaintBrush = useSelector(
    (state: RootState) => state.interaction.actorPaintBrush
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToolButton
        activeToolId={activeToolId}
        onCloseMenus={onCloseMenus}
        onSelected={onSelected}
        tool={tool}
      />
      {activeToolId === "actor" ? (
        <>
          <div
            aria-label="Actor faction"
            className={optionGroupClassName()}
            role="group"
          >
            {FACTION_OPTIONS.map((option) => (
              <button
                key={option.value}
                aria-label={option.label}
                aria-pressed={actorTool.layoutGroup === option.value}
                className={optionButtonClassName(
                  actorTool.layoutGroup === option.value
                )}
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
              </button>
            ))}
          </div>
          <div
            aria-label="Actor size"
            className={optionGroupClassName()}
            role="group"
          >
            {SIZE_OPTIONS.map(({ Icon, label, title, value }) => (
              <button
                key={value}
                aria-label={label}
                aria-pressed={actorTool.size === value}
                className={optionButtonClassName(actorTool.size === value)}
                onClick={() => dispatch(setActorToolSize(value))}
                title={title}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4 fill-current" />
              </button>
            ))}
          </div>
          <div
            aria-label="Actor shape"
            className={optionGroupClassName()}
            role="group"
          >
            {SHAPE_OPTIONS.map(({ Icon, label, title, value }) => (
              <button
                key={value}
                aria-label={label}
                aria-pressed={actorTool.shape === value}
                className={optionButtonClassName(actorTool.shape === value)}
                onClick={() => dispatch(setActorToolShape(value))}
                title={title}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4 fill-current" />
              </button>
            ))}
          </div>
          <div
            aria-label="Create Actor"
            className={optionGroupClassName()}
            role="group"
          >
            <button
              aria-label="Create actor"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-ink shadow-sm transition hover:bg-canvas"
              onClick={() => setCreateModalOpen(true)}
              title="Create actor"
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <div
            aria-label="Actor paint"
            className={optionGroupClassName()}
            role="group"
          >
            <button
              aria-label="Paint actors"
              aria-pressed={actorPaintBrush}
              className={optionButtonClassName(actorPaintBrush)}
              onClick={() => dispatch(toggleActorPaintBrush())}
              title="Paint"
              type="button"
            >
              <Paintbrush aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}
      {createModalOpen ? (
        <ActorCreationModal onClose={() => setCreateModalOpen(false)} />
      ) : null}
    </div>
  );
}
