import {
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";

import type { LayoutPoint } from "@core/layout/types";

type MotionCoordinates = {
  x: number | number[];
  y: number | number[];
};

type ActorMotionTrackProps = {
  children: (
    coordinates: MotionCoordinates,
    completeTrack: () => void
  ) => ReactNode;
  direct: boolean;
  incomingPoint?: LayoutPoint;
  onIncomingPointCommitted?: () => void;
  target: LayoutPoint;
};

type TrackState = {
  pathStart?: LayoutPoint;
  revision: number;
  target: LayoutPoint;
};

function pointsMatch(
  left: LayoutPoint | undefined,
  right: LayoutPoint | undefined
): boolean {
  return left?.x === right?.x && left?.y === right?.y;
}

/**
 * Commits an actor's last visible point before starting its next Motion track.
 * This prevents worker/proactive layout updates from replacing the drop frame.
 */
export function ActorMotionTrack({
  children,
  direct,
  incomingPoint,
  onIncomingPointCommitted,
  target
}: ActorMotionTrackProps) {
  const processedIncomingPoint = useRef<LayoutPoint>();
  const [track, setTrack] = useState<TrackState>(() => ({
    revision: 0,
    target: incomingPoint ?? target
  }));
  const hasNewIncomingPoint =
    Boolean(incomingPoint) &&
    incomingPoint !== processedIncomingPoint.current;

  useEffect(() => {
    if (direct) {
      processedIncomingPoint.current = incomingPoint;
      setTrack((current) =>
        pointsMatch(current.target, target) && !current.pathStart
          ? current
          : { revision: current.revision + 1, target }
      );
      return;
    }

    if (hasNewIncomingPoint && incomingPoint) {
      processedIncomingPoint.current = incomingPoint;
      onIncomingPointCommitted?.();
      setTrack((current) => ({
        pathStart: incomingPoint,
        revision: current.revision + 1,
        target
      }));
      return;
    }

    setTrack((current) =>
      pointsMatch(current.target, target)
        ? current
        : {
            pathStart: current.target,
            revision: current.revision + 1,
            target
          }
    );
  }, [
    direct,
    hasNewIncomingPoint,
    incomingPoint,
    onIncomingPointCommitted,
    target
  ]);

  const coordinates = direct
    ? target
    : hasNewIncomingPoint && incomingPoint
      ? incomingPoint
      : track.pathStart
        ? {
            x: [track.pathStart.x, track.target.x],
            y: [track.pathStart.y, track.target.y]
          }
        : track.target;

  function completeTrack() {
    const completedRevision = track.revision;

    setTrack((current) =>
      current.pathStart && current.revision === completedRevision
        ? { revision: current.revision, target: current.target }
        : current
    );
  }

  return children(coordinates, completeTrack);
}
