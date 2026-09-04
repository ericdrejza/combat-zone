import type {
  ActorLayoutGroup,
  ActorShape,
  ActorSize
} from '@entities/actor/types';
import {
  ACTOR_LAYOUT_GROUP_COLORS,
  ACTOR_SIZE_MULTIPLIERS
} from '@entities/actor/actorVisuals';
import type { ImageAssetSource } from '@core/assets/imageAssetSource';
import { directImageSourceUrl } from '@core/assets/imageAssetSource';

type ActorDragPreviewInput = {
  image?: ImageAssetSource;
  layoutGroup: ActorLayoutGroup;
  name: string;
  shape: ActorShape;
  size: ActorSize;
};

const PREVIEW_TOKEN_SIZE = 56;

function createPreviewElement({
  image,
  layoutGroup,
  name,
  shape,
  size
}: ActorDragPreviewInput): HTMLDivElement {
  const colors = ACTOR_LAYOUT_GROUP_COLORS[layoutGroup];
  const tokenSize = Math.max(
    36,
    PREVIEW_TOKEN_SIZE * ACTOR_SIZE_MULTIPLIERS[size]
  );
  const preview = document.createElement('div');
  const token = document.createElement('div');
  const label = document.createElement('div');

  preview.setAttribute('aria-hidden', 'true');
  preview.style.alignItems = 'center';
  preview.style.display = 'flex';
  preview.style.flexDirection = 'column';
  preview.style.gap = '4px';
  preview.style.left = '-10000px';
  preview.style.position = 'fixed';
  preview.style.top = '-10000px';
  preview.style.zIndex = '9999';

  token.style.alignItems = 'center';
  token.style.backgroundColor = colors.fill;
  token.style.border = '3px solid white';
  token.style.borderRadius = shape === 'circle' ? '50%' : '8px';
  token.style.boxSizing = 'border-box';
  token.style.color = 'white';
  token.style.display = 'flex';
  token.style.fontFamily = 'sans-serif';
  token.style.fontSize = '10px';
  token.style.fontWeight = '700';
  token.style.height = `${tokenSize}px`;
  token.style.justifyContent = 'center';
  token.style.overflow = 'hidden';
  token.style.width = `${tokenSize}px`;

  const imageUrl = image ? directImageSourceUrl(image) : null;

  if (imageUrl) {
    const imageElement = document.createElement('img');

    imageElement.alt = '';
    imageElement.src = imageUrl;
    imageElement.style.height = '100%';
    imageElement.style.objectFit = 'cover';
    imageElement.style.width = '100%';
    token.append(imageElement);
  } else {
    token.textContent = name.slice(0, 2).toUpperCase();
  }

  label.textContent = name;
  label.style.backgroundColor = colors.fill;
  label.style.borderRadius = '4px';
  label.style.color = 'white';
  label.style.fontFamily = 'sans-serif';
  label.style.fontSize = '11px';
  label.style.fontWeight = '600';
  label.style.maxWidth = `${Math.max(tokenSize, 80)}px`;
  label.style.overflow = 'hidden';
  label.style.padding = '2px 5px';
  label.style.textOverflow = 'ellipsis';
  label.style.whiteSpace = 'nowrap';

  preview.append(token, label);

  return preview;
}

/** Sets an actor-shaped native drag image and returns its cleanup callback. */
export function setActorDragImage(
  dataTransfer: DataTransfer,
  input: ActorDragPreviewInput
): () => void {
  if (typeof dataTransfer.setDragImage !== 'function') {
    return () => undefined;
  }

  const preview = createPreviewElement(input);

  document.body.append(preview);
  dataTransfer.setDragImage(
    preview,
    preview.offsetWidth / 2,
    preview.offsetHeight / 2
  );

  return () => preview.remove();
}
