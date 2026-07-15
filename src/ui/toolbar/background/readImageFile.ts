import type { EncounterBackgroundImage } from '@core/encounter/types';

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

      resolve({
        dataUrl: reader.result,
        mediaType: file.type || 'application/octet-stream',
        name: file.name
      });
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Selected file could not be read.'));
    });
    reader.readAsDataURL(file);
  });
}
