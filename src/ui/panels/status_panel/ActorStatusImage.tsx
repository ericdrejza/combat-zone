import { motion } from 'motion/react';
import type { Actor } from '@entities/actor/types';

/** Status thumbnails share token shape and mirroring in every placement. */
export function ActorStatusImage({ actor, src, className, size }: { actor: Actor; src: string; className: string; size?: number }) {
  return <motion.img alt={`${actor.name} token`} src={src} draggable={false}
    initial={false} animate={{ scaleX: actor.imageFlippedHorizontal ? -1 : 1 }}
    style={size === undefined ? undefined : { width: size, height: size }}
    className={`${className} ${actor.shape === 'transparent' ? 'object-contain' : `object-cover ${actor.shape === 'rectangle' ? 'rounded-md' : 'rounded-full'}`}`} />;
}
