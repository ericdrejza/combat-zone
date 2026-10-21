import { motion } from 'motion/react';
import type { Actor } from '@entities/actor/types';
import { useActorStatusNavigation } from './ActorStatusNavigationProvider';

/** Status thumbnails share token shape and navigate without changing viewport zoom. */
export function ActorStatusImage({ actor, src, className, size }: { actor: Actor; src: string; className: string; size?: number }) {
  const navigation = useActorStatusNavigation();
  const dimensions = size === undefined ? undefined : { width: size, height: size };
  const shape = actor.shape === 'transparent' ? 'object-contain' : `object-cover ${actor.shape === 'rectangle' ? 'rounded-md' : 'rounded-full'}`;
  const image = <motion.img alt={`${actor.name} token`} src={src} draggable={false}
    initial={false} animate={{ scaleX: actor.imageFlippedHorizontal ? -1 : 1 }}
    style={navigation ? undefined : dimensions}
    className={`${navigation ? 'h-full w-full' : className} ${shape}`} />;
  if (!navigation) return image;
  const placed = navigation.points.has(actor.id);
  const label = placed ? `Center viewport on ${actor.name}` : `${actor.name} is not on the canvas`;
  return <button type="button" aria-label={label} title={label} data-touch-tooltip-label={label}
    disabled={!placed} onClick={() => navigation.navigate(actor.id)} style={dimensions}
    className={`${className} ${actor.shape === 'circle' ? 'rounded-full' : 'rounded-md'} enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40`}>
    {image}
  </button>;
}
