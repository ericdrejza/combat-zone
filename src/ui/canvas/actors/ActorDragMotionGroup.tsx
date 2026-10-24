import type { ComponentProps } from 'react';
import type { LayoutPoint } from '@core/layout/types';
import { ActorMotionGroup } from './ActorOverlayLayers';
import { useActorDragCallbacks, type ActorDragCallbacks } from './useActorDragCallbacks';

type Props = Omit<ComponentProps<typeof ActorMotionGroup>, 'onDrag' | 'onDragStart' | 'onDragEnd'> & {
  dragOrigin: LayoutPoint;
  dragCallbacks: ActorDragCallbacks;
};

export function ActorDragMotionGroup({ dragOrigin, dragCallbacks, ...props }: Props) {
  const handlers = useActorDragCallbacks(dragOrigin, dragCallbacks);
  return <ActorMotionGroup {...props} {...handlers} />;
}
