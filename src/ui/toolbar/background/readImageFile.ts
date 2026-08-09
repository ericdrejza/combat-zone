import type { EncounterBackgroundImage } from '@core/encounter/types';
import type { LibraryImageAsset } from '@library/types';

export function readImageAssetDimensions(
  asset: LibraryImageAsset
): Promise<EncounterBackgroundImage> {
  if (asset.width && asset.height) {
    return Promise.resolve({ ...asset, height: asset.height, width: asset.width });
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve({
        ...asset,
        height: image.naturalHeight || image.height,
        width: image.naturalWidth || image.width
      });
    });
    image.addEventListener('error', () => {
      reject(new Error('Selected image could not be decoded.'));
    });
    image.src = asset.dataUrl;
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
        dataUrl: reader.result,
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
