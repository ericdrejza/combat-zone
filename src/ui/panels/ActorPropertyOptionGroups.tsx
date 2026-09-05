import { Circle } from "lucide-react";

import type { UpdateActorPropertiesInput } from "@entities/actor/actorMutations";
import type { Actor } from "@entities/actor/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup
} from "@ui/toolbar/ToolbarOption";
import {
  ACTOR_FACTION_OPTIONS,
  ACTOR_SHAPE_OPTIONS,
  ACTOR_SIZE_OPTIONS
} from "@ui/toolbar/actor/actorOptionMetadata";

type ActorPropertyOptionGroupsProps = {
  actor: Pick<Actor, "layoutGroup" | "shape" | "size">;
  onChange: (properties: UpdateActorPropertiesInput) => void;
};

const BUTTON_CLASS_NAME = "!h-8 !w-8 !min-w-8 !px-0";
const GROUP_CLASS_NAME = "shrink-0 !p-0.5 shadow-none";

export function ActorPropertyOptionGroups({
  actor,
  onChange
}: ActorPropertyOptionGroupsProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-canvas-ink">Faction</span>
        <ToolbarOptionGroup aria-label="Actor faction" className={GROUP_CLASS_NAME} role="group">
          {ACTOR_FACTION_OPTIONS.map((option) => (
            <ToolbarOptionButton
              key={option.value}
              active={actor.layoutGroup === option.value}
              aria-label={`Set actor faction to ${option.title}`}
              aria-pressed={actor.layoutGroup === option.value}
              className={BUTTON_CLASS_NAME}
              onClick={() => onChange({ layoutGroup: option.value })}
              title={option.title}
              type="button"
            >
              <Circle
                aria-hidden="true"
                className={`h-4 w-4 fill-current ${
                  ACTOR_LAYOUT_GROUP_COLORS[option.value].iconClassName
                }`}
              />
            </ToolbarOptionButton>
          ))}
        </ToolbarOptionGroup>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-canvas-ink">Size</span>
        <ToolbarOptionGroup aria-label="Actor size" className={GROUP_CLASS_NAME} role="group">
          {ACTOR_SIZE_OPTIONS.map(({ Icon, title, value }) => (
            <ToolbarOptionButton
              key={value}
              active={actor.size === value}
              aria-label={`Set actor size to ${title}`}
              aria-pressed={actor.size === value}
              className={BUTTON_CLASS_NAME}
              onClick={() => onChange({ size: value })}
              title={title}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4 fill-current" />
            </ToolbarOptionButton>
          ))}
        </ToolbarOptionGroup>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-canvas-ink">Shape</span>
        <ToolbarOptionGroup aria-label="Actor shape" className={GROUP_CLASS_NAME} role="group">
          {ACTOR_SHAPE_OPTIONS.map(({ Icon, title, value }) => (
            <ToolbarOptionButton
              key={value}
              active={actor.shape === value}
              aria-label={`Set actor shape to ${title}`}
              aria-pressed={actor.shape === value}
              className={BUTTON_CLASS_NAME}
              onClick={() => onChange({ shape: value })}
              title={title}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4 fill-current" />
            </ToolbarOptionButton>
          ))}
        </ToolbarOptionGroup>
      </div>
    </>
  );
}
