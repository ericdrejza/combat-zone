import { SquareCenterlineDashedHorizontal } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { ToolbarOptionButton } from "@ui/toolbar/ToolbarOption";
import { useActorPropertiesActions } from "./useActorPropertiesActions";

/** Mirror only artwork; placement, outlines, and upright labels stay unchanged. */
export function ActorPropertiesHeaderActions() {
  const { actor, commitActorProperties } = useActorPropertiesActions();
  const tool = useSelector((state: RootState) => state.interaction.activeToolId);
  if (!actor || ["background", "grid", "audio"].includes(tool)) return null;
  const flipped = actor.imageFlippedHorizontal ?? false;
  return <ToolbarOptionButton aria-label="Flip actor image" title="Flip actor image"
    aria-pressed={flipped} active={flipped} disabled={!actor.image}
    onClick={() => commitActorProperties({ imageFlippedHorizontal: !flipped })}>
    <SquareCenterlineDashedHorizontal aria-hidden="true" className="h-4 w-4" />
  </ToolbarOptionButton>;
}
