import { useEffect, useRef } from 'react';
import { Swords } from 'lucide-react';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  type MotionValue
} from 'motion/react';

import type { LayoutPoint } from '@core/layout/types';
import type { RootState } from '@store/store';
import { getReadableTextColor } from '../canvasLuminance';
import type { EngagementDragState } from '../canvasInteractionTypes';
import {
  ENGAGEMENT_TOKEN_RADIUS,
  type EngagementConnector
} from './engagementGeometry';

type EngagementVisualProps = {
  activeToolId: RootState['interaction']['activeToolId'];
  color: string;
  connectors: EngagementConnector[];
  drag: EngagementDragState | null;
  engagementId: string;
  hiddenActorIds?: ReadonlySet<string>;
  isDropTarget: boolean;
  onDrag: (point: LayoutPoint) => void;
  onDragEnd: () => void;
  onDragReturnComplete: () => void;
  onDragStart: (engagementId: string, point: LayoutPoint) => void;
  onSelect: (engagementId: string, toggle?: boolean) => void;
  selected: boolean;
  targetOutlineColor: string;
  token: LayoutPoint;
};

function isSamePoint(left: LayoutPoint, right: LayoutPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function EngagementConnectorLine({
  color,
  connector,
  followsToken,
  tokenX,
  tokenY
}: {
  color: string;
  connector: EngagementConnector;
  followsToken: boolean;
  tokenX: MotionValue<number>;
  tokenY: MotionValue<number>;
}) {
  const lineRef = useRef<SVGLineElement | null>(null);
  useMotionValueEvent(tokenX, 'change', (value) => {
    if (followsToken) lineRef.current?.setAttribute('x1', String(value));
  });
  useMotionValueEvent(tokenY, 'change', (value) => {
    if (followsToken) lineRef.current?.setAttribute('y1', String(value));
  });
  return (
    <line
      data-engagement-connector="true"
      ref={lineRef}
      stroke={color}
      strokeLinecap="round"
      strokeOpacity="0.8"
      strokeWidth="2"
      x1={followsToken ? tokenX.get() : connector.from.x}
      x2={connector.to.x}
      y1={followsToken ? tokenY.get() : connector.from.y}
      y2={connector.to.y}
    />
  );
}

/**
 * Keeps pointer-rate token movement inside MotionValues so dragging does not
 * rerender the canvas layout on every pointer event.
 */
export function EngagementVisual({
  activeToolId,
  color,
  connectors,
  drag,
  engagementId,
  hiddenActorIds,
  isDropTarget,
  onDrag,
  onDragEnd,
  onDragReturnComplete,
  onDragStart,
  onSelect,
  selected,
  targetOutlineColor,
  token
}: EngagementVisualProps) {
  const isActiveDrag = drag?.engagementId === engagementId;
  const initialPoint =
    isActiveDrag && drag.phase === 'dragging' ? drag.current : token;
  const tokenX = useMotionValue(initialPoint.x);
  const tokenY = useMotionValue(initialPoint.y);

  useEffect(() => {
    if (!isActiveDrag) {
      tokenX.set(token.x);
      tokenY.set(token.y);
    }
  }, [isActiveDrag, token.x, token.y, tokenX, tokenY]);

  useEffect(() => {
    if (!isActiveDrag || drag.phase !== 'returning') {
      return;
    }

    const xAnimation = animate(tokenX, token.x, {
      duration: 0.15,
      ease: 'easeOut'
    });
    const yAnimation = animate(tokenY, token.y, {
      duration: 0.15,
      ease: 'easeOut'
    });
    void Promise.all([xAnimation, yAnimation]).then(() => {
      onDragReturnComplete();
    });

    return () => {
      xAnimation.stop();
      yAnimation.stop();
    };
  }, [
    drag?.phase,
    isActiveDrag,
    onDragReturnComplete,
    token.x,
    token.y,
    tokenX,
    tokenY
  ]);

  return (
    <g
      aria-label="Engagement"
      data-entity-id={engagementId}
      data-entity-type="engagement"
    >
      {connectors
        .filter(
          (connector) =>
            !hiddenActorIds?.has(connector.actorId) &&
            (!connector.viaActorId ||
              !hiddenActorIds?.has(connector.viaActorId))
        )
        .map((connector) => {
          const followsToken = isSamePoint(connector.from, token);
          return (
            <EngagementConnectorLine
              key={connector.actorId}
              color={color}
              connector={connector}
              followsToken={followsToken}
              tokenX={tokenX}
              tokenY={tokenY}
            />
          );
        })}
      <motion.g
        className="cursor-grab active:cursor-grabbing"
        drag={activeToolId === 'actor' || activeToolId === 'select'}
        dragElastic={0}
        dragMomentum={false}
        initial={false}
        onDrag={() => onDrag({ x: tokenX.get(), y: tokenY.get() })}
        onDragEnd={onDragEnd}
        onDragStart={() => onDragStart(engagementId, token)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(
            engagementId,
            event.shiftKey || event.ctrlKey || event.metaKey
          );
        }}
        style={{ x: tokenX, y: tokenY }}
      >
        {isDropTarget ? (
          <motion.circle
            animate={{ opacity: 1, r: ENGAGEMENT_TOKEN_RADIUS + 5 }}
            className="pointer-events-none fill-none"
            data-engagement-drop-target="true"
            initial={{ opacity: 0, r: ENGAGEMENT_TOKEN_RADIUS + 2 }}
            stroke={targetOutlineColor}
            strokeWidth="3"
            transition={{ duration: 0.12 }}
          />
        ) : null}
        <circle
          fill={color}
          r={ENGAGEMENT_TOKEN_RADIUS}
          stroke={color}
          strokeWidth={selected ? 3 : 2}
        />
        <Swords
          aria-label="Crossed swords"
          height="14"
          stroke={getReadableTextColor(color)}
          width="14"
          x="-7"
          y="-7"
        />
      </motion.g>
    </g>
  );
}
