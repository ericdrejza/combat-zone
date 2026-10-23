import { useResolvedImageSource } from '@core/assets/ImageAssetResolver';
import type { Actor } from '@entities/actor/types';
import { ActorStatusImage } from './ActorStatusImage';

/** Keep each selected actor's name and optional token together in both Status views. */
export function ActorStatusName({ actor, displayName = actor.name, largeImage = false, showImage = true }: { actor: Actor; displayName?: string; largeImage?: boolean; showImage?: boolean }) {
  const imageUrl = useResolvedImageSource(showImage ? actor.image : undefined);
  return <div className={`relative flex min-w-0 items-center gap-2 ${largeImage && showImage && imageUrl ? 'pr-20' : ''}`}>
    <p className="min-w-0 break-words font-semibold">{displayName}</p>
    {showImage && imageUrl ? <ActorStatusImage actor={actor} displayName={displayName} src={imageUrl}
      className={largeImage ? 'absolute -top-2 right-0 h-16 w-16' : 'h-5 w-5 shrink-0'} /> : null}
  </div>;
}
