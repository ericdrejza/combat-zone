import { Circle, Square } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type {
  ActorLayoutGroup,
  ActorShape,
  ActorSize
} from "@entities/actor/types";

type TokenSizeIconProps = SVGProps<SVGSVGElement>;

export const ACTOR_FACTION_OPTIONS: Array<{
  label: string;
  keybind: string;
  title: string;
  value: ActorLayoutGroup;
}> = [
  { keybind: "1", label: "Hero faction", title: "Hero", value: "hero" },
  { keybind: "2", label: "Ally faction", title: "Ally", value: "ally" },
  { keybind: "3", label: "Neutral faction", title: "Neutral", value: "neutral" },
  { keybind: "4", label: "Enemy faction", title: "Enemy", value: "enemy" }
];

export const ACTOR_SIZE_OPTIONS: Array<{
  Icon: ComponentType<TokenSizeIconProps>;
  keybind: string;
  label: string;
  title: string;
  value: ActorSize;
}> = [
  { Icon: SmallTokenIcon, keybind: "5", label: "Small actor size", title: "Small", value: "small" },
  { Icon: MediumTokenIcon, keybind: "6", label: "Medium actor size", title: "Medium", value: "medium" },
  { Icon: LargeTokenIcon, keybind: "7", label: "Large actor size", title: "Large", value: "large" },
  { Icon: XLargeTokenIcon, keybind: "8", label: "X-large actor size", title: "Huge", value: "xLarge" }
];

export const ACTOR_SHAPE_OPTIONS: Array<{
  Icon: typeof Circle;
  keybind: string;
  label: string;
  title: string;
  value: ActorShape;
}> = [
  { Icon: Circle, keybind: "9", label: "Circle actor shape", title: "Circle", value: "circle" },
  { Icon: Square, keybind: "0", label: "Rectangle actor shape", title: "Rectangle", value: "rectangle" }
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
          <rect fill="currentColor" height="5" key={`${x}-${y}`} rx="1" width="5" x={x} y={y} />
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
          <rect fill="currentColor" height="4" key={`${x}-${y}`} rx="0.75" width="4" x={x} y={y} />
        ))
      )}
    </svg>
  );
}
