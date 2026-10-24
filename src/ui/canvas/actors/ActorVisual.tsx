import { ActorTokenName } from "./ActorTokenName";
import { ActorOverlay } from "./ActorOverlayLayers";
import { ActorConditionIcons } from "./ActorConditionIcons";
import { ActorResourceBars } from "./ActorResourceBars";
import { resolvedResourceBars } from "@entities/actor/resourceBars";
import { ActorSelectionOutline } from './ActorSelectionOutline';
import { actorSelectionSampleOffsets, type ActorSurfaceContrast } from './actorSurfaceContrast';
import { actorLabelOffset } from './actorLabelGeometry';
import { motion, type Transition } from "motion/react";
import { memo } from "react";

import type { Actor } from "@entities/actor/types";
import { getReadableTextColor } from "../canvasLuminance";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import { isVideoMediaType } from "@library/mediaAsset";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ControlledVideo } from "@core/rendering/ControlledVideo";
import { useStillImageSource } from "@core/assets/useStillImageSource";
import { isAnimatedAsset } from "@library/mediaAsset";
import { ActorProjection } from './ActorProjection';

type ActorVisualProps = {
  hidden?: boolean;
  actor: Actor;
  displayName?: string;
  showResourceBars?: boolean;
  showConditions?: boolean;
  artworkClipId?: string;
  fillColor: string;
  outlineColor: string;
  radius: number;
  selected: boolean;
  selectedTextColor: string;
  surfaceContrast?: ActorSurfaceContrast;
  showFactionOutline: boolean;
  clipId: string;
  transition: Transition;
  projectionRotation?: number;
  projectionAngle?: number;
};

/**
 * Renders the actor-local SVG geometry while its parent owns placement.
 * Radius-derived attributes share the placement transition so resizing and
 * layout changes remain visually synchronized.
 */
export const ActorVisual = memo(function ActorVisual({
  actor,
  hidden = false,
  displayName = actor.name,
  showResourceBars = false,
  showConditions = false,
  artworkClipId,
  fillColor,
  outlineColor,
  radius,
  selected,
  selectedTextColor,
  surfaceContrast,
  showFactionOutline,
  clipId,
  transition,
  projectionRotation, projectionAngle
}: ActorVisualProps) {
  const innerRadius = Math.max(radius - (actor.shape === 'transparent' ? 0 : 3), 1);
  const tokenContrastColor = getReadableTextColor(fillColor);
  const selectionRadius = radius + 5;
  const factionRadius = radius + 9;
  const imageUrl = useResolvedImageSource(actor.image);
  const isVideo = isVideoMediaType(
    typeof actor.metadata.sourceAssetMediaType === "string"
      ? actor.metadata.sourceAssetMediaType
      : undefined
  );
  const { enableAssetAnimation, actorSelectionOutlineWidth, actorBorderThickness, showActorStatusesOnCanvas } = useInterfacePreferences();
  const isAnimatedWebp = Boolean(actor.image) && isAnimatedAsset({
    animated: actor.metadata.sourceAssetAnimated === true,
    mediaType: typeof actor.metadata.sourceAssetMediaType === "string"
      ? actor.metadata.sourceAssetMediaType
      : "image/*",
    name: actor.name,
    source: actor.image as NonNullable<typeof actor.image>
  });
  const renderedImageUrl = useStillImageSource(
    imageUrl,
    !enableAssetAnimation && (isAnimatedWebp || isVideo),
    isVideo ? "video" : "image"
  );
  const labelOffset = actorLabelOffset(actor.shape, radius, projectionRotation, projectionAngle);
  const barTop = labelOffset - 8;
  const conditionTop = 10 - labelOffset;
  const barCount = showResourceBars && showActorStatusesOnCanvas ? resolvedResourceBars(actor).length : 0;
  const showExternalActorName = Boolean(imageUrl) && (showFactionOutline || selected);
  const surfaceColor = surfaceContrast?.({ x: 0, y: 0 }) ?? selectedTextColor;
  const selectionColor = selected ? surfaceContrast?.(actorSelectionSampleOffsets(actor.shape, selectionRadius, projectionRotation, projectionAngle)) ?? selectedTextColor : selectedTextColor;
  const nameOffset = labelOffset - 5 + (barCount ? barCount * 7 + 1 : 0);

  // A token without artwork keeps its identifying text visible inside its own shape.
  const tokenName = !imageUrl ? (
    <ActorTokenName name={displayName} shape={actor.shape} radius={radius}
      color={actor.shape === "transparent" ? surfaceColor : tokenContrastColor}
      transition={transition} />
  ) : null;

  return (
    <g visibility={hidden ? "hidden" : undefined}>
      {projectionRotation !== undefined || actor.shape === 'transparent' ? actor.shape !== 'circle'
        ? <rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} fill="transparent" pointerEvents="all" data-actor-logical-hit-area />
        : <circle r={radius} fill="transparent" pointerEvents="all" data-actor-logical-hit-area /> : null}
      <g clipPath={artworkClipId ? `url(#${artworkClipId})` : undefined}>
      <ActorProjection rotation={projectionRotation} angle={projectionAngle} transition={transition}>
      {actor.shape === "transparent" ? null : actor.shape === "rectangle" ? (
        <motion.rect
          fill={fillColor}
          stroke={tokenContrastColor}
          initial={false}
          animate={{
            attrX: -radius,
            attrY: -radius,
            height: radius * 2,
            strokeWidth: actorBorderThickness + (selected ? 2 : 0),
            width: radius * 2
          }}
          rx="6"
          transition={transition}
        />
      ) : (
        <motion.circle
          fill={fillColor}
          stroke={tokenContrastColor}
          initial={false}
          animate={{ r: radius, strokeWidth: actorBorderThickness + (selected ? 2 : 0) }}
          transition={transition}
        />
      )}
      {imageUrl ? (
        <>
          {actor.shape !== 'transparent' ? <clipPath id={clipId}>
            {actor.shape === "rectangle" ? (
              <motion.rect
                initial={false}
                animate={{
                  attrX: -innerRadius,
                  attrY: -innerRadius,
                  height: innerRadius * 2,
                  width: innerRadius * 2
                }}
                rx="4"
                transition={transition}
              />
            ) : (
              <motion.circle
                initial={false}
                animate={{ r: innerRadius }}
                transition={transition}
              />
            )}
          </clipPath> : null}
          <motion.g initial={false} animate={{ scaleX: actor.imageFlippedHorizontal ? -1 : 1 }}
            style={{ transformOrigin: "0px 0px" }} transition={transition} data-actor-image-artwork>
          {isVideo && enableAssetAnimation ? (
            <motion.foreignObject
              height={innerRadius * 2}
              initial={false}
              animate={{ attrX: -innerRadius, attrY: -innerRadius }}
              pointerEvents="none"
              transition={transition}
              width={innerRadius * 2}
              x={-innerRadius}
              y={-innerRadius}
            >
              <ControlledVideo
                className={actor.shape === "transparent" ? "h-full w-full object-contain" : `h-full w-full object-cover ${actor.shape === "circle" ? "rounded-full" : "rounded"}`}
                play={enableAssetAnimation}
                src={imageUrl}
              />
            </motion.foreignObject>
          ) : (
            <motion.image
              clipPath={actor.shape === "transparent" ? undefined : `url(#${clipId})`}
              href={renderedImageUrl ?? undefined}
              initial={false}
              animate={{
                attrX: -innerRadius,
                attrY: -innerRadius,
                height: innerRadius * 2,
                width: innerRadius * 2
              }}
              preserveAspectRatio={actor.shape === "transparent" ? "xMidYMid meet" : "xMidYMid slice"}
              transition={transition}
            />
          )}
          </motion.g>
        </>
      ) : null}
      </ActorProjection>
      </g>
      {!selected ? tokenName : null}
      <ActorProjection rotation={projectionRotation} angle={projectionAngle} transition={transition}>
      {selected ? (
        <ActorSelectionOutline shape={actor.shape} radius={selectionRadius}
          color={selectionColor} width={actorSelectionOutlineWidth} transition={transition} />
      ) : null}
      {showFactionOutline && actor.shape !== "transparent" ? (
        actor.shape !== "circle" ? (
          <motion.rect
            className="pointer-events-none fill-none"
            initial={false}
            animate={{
              attrX: -factionRadius,
              attrY: -factionRadius,
              height: factionRadius * 2,
              strokeWidth: 4,
              width: factionRadius * 2
            }}
            rx="10"
            stroke={outlineColor}
            transition={transition}
          />
        ) : (
          <motion.circle
            className="pointer-events-none fill-none"
            initial={false}
            animate={{ r: factionRadius, strokeWidth: 4 }}
            stroke={outlineColor}
            transition={transition}
          />
        )
      ) : null}
      </ActorProjection>
      <ActorOverlay selected={selected} hidden={hidden}>
      {selected ? tokenName : null}
      {showConditions && showActorStatusesOnCanvas ? <ActorConditionIcons selected={selected} actor={actor} radius={radius} top={conditionTop} transition={transition} /> : null}
      {showResourceBars && showActorStatusesOnCanvas ? <ActorResourceBars selected={selected} textColor={surfaceColor} surfaceContrast={surfaceContrast} actor={actor} radius={radius} top={barTop} transition={transition} /> : null}
      {showExternalActorName ? (
        <motion.text
          className="pointer-events-none text-[10px] font-bold z-10"
          dominantBaseline="middle"
          fill={surfaceContrast?.({ x: 0, y: nameOffset }) ?? selectedTextColor}
          initial={false}
          animate={{ dy: nameOffset }}
          textAnchor="middle"
          transition={transition}
        >
          {displayName.toUpperCase()}
        </motion.text>
      ) : null}
      </ActorOverlay>
    </g>
  );
});
