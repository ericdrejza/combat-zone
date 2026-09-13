import type { EncounterBackgroundImage } from '@core/encounter/types';
import type { LibraryImageAsset } from '@library/types';
import { directImageSourceUrl } from '@core/assets/imageAssetSource';
import type { ImageAssetResolver } from '@core/assets/ImageAssetResolver';
import { isVideoMediaType } from '@library/mediaAsset';

export function readImageAssetDimensions(
  asset: LibraryImageAsset,
  resolveRemote?: ImageAssetResolver
): Promise<EncounterBackgroundImage> {
  if (asset.width && asset.height) {
    return Promise.resolve({ ...asset, height: asset.height, width: asset.width });
  }

  return new Promise((resolve, reject) => {
    const isVideo = isVideoMediaType(asset.mediaType);
    const image = isVideo ? document.createElement('video') : new Image();
    image.addEventListener(isVideo ? 'loadedmetadata' : 'load', () => {
      resolve({
        ...asset,
        height: image instanceof HTMLVideoElement
          ? image.videoHeight
          : image.naturalHeight || image.height,
        width: image instanceof HTMLVideoElement
          ? image.videoWidth
          : image.naturalWidth || image.width
      });
    });
    image.addEventListener('error', () => {
      reject(new Error('Selected media could not be decoded.'));
    });
    if (image instanceof HTMLVideoElement) image.preload = 'metadata';
    const sourceUrl = directImageSourceUrl(asset.source);
    if (sourceUrl) {
      image.src = sourceUrl;
      return;
    }
    if (!resolveRemote) {
      reject(new Error('The selected remote image is not cached yet.'));
      return;
    }
    void resolveRemote(asset.source).then((value) => {
      if (typeof value === 'string') {
        image.src = value;
        return;
      }
      const objectUrl = URL.createObjectURL(value);
      image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
      image.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });
      image.src = objectUrl;
    }, reject);
  });
}

/** Returns the first image file carried by a native drag-and-drop payload. */
export function getDroppedImageFile(
  dataTransfer: DataTransfer
): File | undefined {
  const directFile = Array.from(dataTransfer.files ?? []).find((file) =>
    file.type.startsWith('image/')
  );

  if (directFile) {
    return directFile;
  }

  return Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .find((file): file is File => Boolean(file?.type.startsWith('image/')));
}

export function readImageFile(file: File): Promise<EncounterBackgroundImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Selected file could not be read as an image.'));
        return;
      }

      void readImageAssetDimensions({
        source: { kind: 'embedded', dataUrl: reader.result },
        mediaType: file.type || 'application/octet-stream',
        name: file.name
      }).then(resolve, reject);
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Selected file could not be read.'));
    });
    reader.readAsDataURL(file);
  });
}
