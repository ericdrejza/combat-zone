import type { Dispatch, UnknownAction } from "@reduxjs/toolkit";

import { stripFileExtension } from "@entities/actor/actorMutations";
import { createFolder, uploadImage } from "@library/librarySlice";
import type { LibrarySectionId } from "@library/types";
import { readImageFile } from "../toolbar/background/readImageFile";
import type { DroppedImageFile } from "./libraryFileDrop";

type CreateImageFilesOptions = {
  dispatch: Dispatch<UnknownAction>;
  files: DroppedImageFile[];
  rootParentId: string;
  sectionId: LibrarySectionId;
};

export async function createImageFilesInFolder({
  dispatch,
  files,
  rootParentId,
  sectionId
}: CreateImageFilesOptions) {
  const folderIdsByPath = new Map<string, string>();

  for (const { file, relativePath } of files) {
    if (!file.type.startsWith("image/")) {
      continue;
    }

    const pathParts = relativePath ? relativePath.split("/") : [file.name];
    const folderParts = pathParts.slice(0, -1).filter(Boolean);
    let parentId = rootParentId;
    let accumulatedPath = "";

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

    const asset = await readImageFile(file);

    dispatch(uploadImage({
      asset: sectionId === "tokens"
        ? { ...asset, name: stripFileExtension(asset.name) }
        : asset,
      parentId,
      sectionId
    }));
  }
}
