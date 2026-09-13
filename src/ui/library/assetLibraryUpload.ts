import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';

import { createFolder, uploadImage } from '@library/librarySlice';
import {
  isSupportedLibraryMediaFile,
  readLibraryMediaFile
} from '@library/mediaAsset';
import type { LibrarySectionId } from '@library/types';
import type { ImageAssetSource } from '@core/assets/imageAssetSource';
import type { DroppedImageFile } from './libraryFileDrop';
import { getFileNameWithoutExtension } from '@library/fileName';

type CreateImageFilesOptions = {
  dispatch: Dispatch<UnknownAction>;
  files: DroppedImageFile[];
  rootParentId: string;
  sectionId: LibrarySectionId;
  storeLocalAsset?: ((blob: Blob) => Promise<ImageAssetSource>) | null;
};

export async function createImageFilesInFolder({
  dispatch,
  files,
  rootParentId,
  sectionId,
  storeLocalAsset
}: CreateImageFilesOptions) {
  const folderIdsByPath = new Map<string, string>();

  for (const { file, relativePath } of files) {
    if (!isSupportedLibraryMediaFile(file)) {
      continue;
    }

    const pathParts = relativePath ? relativePath.split('/') : [file.name];
    const folderParts = pathParts.slice(0, -1).filter(Boolean);
    let parentId = rootParentId;
    let accumulatedPath = '';

    for (const folderName of folderParts) {
      accumulatedPath = accumulatedPath
        ? `${accumulatedPath}/${folderName}`
        : folderName;

      const existingFolderId = folderIdsByPath.get(accumulatedPath);

      if (existingFolderId) {
        parentId = existingFolderId;
        continue;
      }

      const action = createFolder({
        name: folderName,
        parentId,
        sectionId
      });

      dispatch(action);
      folderIdsByPath.set(accumulatedPath, action.payload.id);
      parentId = action.payload.id;
    }

    const asset = await readLibraryMediaFile(file, storeLocalAsset);

    dispatch(
      uploadImage({
        asset: { ...asset, name: getFileNameWithoutExtension(asset.name) },
        parentId,
        sectionId
      })
    );
  }
}
