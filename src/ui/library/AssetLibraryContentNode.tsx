import { FileImage, Folder, Link } from "lucide-react";
import type { DragEvent, PointerEvent } from "react";
import type { MotionValue } from "motion/react";

import type { LibraryImageAsset, LibraryNode } from "@library/types";
import { AssetImagePreview } from "./AssetImagePreview";
import { AssetLibraryAssetTypeIcon } from "./AssetLibraryAssetTypeIcon";
import { getUploadedAssetSizeLabel } from "./assetFileSize";
import type { AssetLibraryViewMode } from "./assetLibraryView";

type AssetLibraryContentNodeProps = {
  asset: LibraryImageAsset | null;
  buttonRef: (button: HTMLButtonElement | null) => void;
  dropFolderId: string | null;
  loadingRotation: MotionValue<string>;
  node: LibraryNode;
  selected: boolean;
  playAnimations: boolean;
  showAssetSize: boolean;
  viewMode: AssetLibraryViewMode;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDoubleClick: () => void;
  onDragOverFolder: (event: DragEvent<HTMLElement>) => void;
  onDropOnFolder: (event: DragEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
};

export function AssetLibraryContentNode({
  asset,
  buttonRef,
  dropFolderId,
  loadingRotation,
  node,
  selected,
  playAnimations,
  showAssetSize,
  viewMode,
  onContextMenu,
  onDoubleClick,
  onDragOverFolder,
  onDropOnFolder,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  onSelect
}: AssetLibraryContentNodeProps) {
  const listView = viewMode === "list";
  const sizeLabel = showAssetSize ? getUploadedAssetSizeLabel(node, asset) : null;
  const itemClass =
    dropFolderId === node.id
      ? "border-canvas-ink bg-canvas ring-2 ring-canvas-ink/20"
      : selected
        ? "border-canvas-ink ring-2 ring-canvas-ink/20"
        : "border-canvas-line";

  return (
    <button
      aria-label={node.name}
      aria-pressed={selected}
      data-library-drag-node-id={node.id}
      data-library-drop-folder-id={node.type === "folder" ? node.id : undefined}
      className={listView
        ? `group flex w-full touch-none select-none items-center gap-3 rounded-xl border bg-canvas-surface p-2 text-left transition hover:bg-canvas ${itemClass}`
        : `touch-none select-none rounded-2xl border bg-canvas-surface p-2 text-left transition hover:bg-canvas ${itemClass}`}
      draggable={false}
      ref={buttonRef}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOverFolder}
      onDrop={onDropOnFolder}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      type="button"
    >
      <span
        className={listView
          ? "flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-lg bg-canvas"
          : "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-canvas"}
      >
        {node.type === "folder" ? (
          <Folder aria-hidden="true" className={listView ? "h-5 w-5" : "h-10 w-10"} />
        ) : node.type === "link" ? (
          <>
            {asset ? (
              <AssetImagePreview
                name={node.name}
                mediaType={asset.mediaType}
                playAnimations={playAnimations}
                rotation={loadingRotation}
                source={asset.source}
              />
            ) : (
              <Link aria-hidden="true" className="h-8 w-8" />
            )}
          </>
        ) : asset ? (
          <AssetImagePreview
            name={node.name}
            mediaType={asset.mediaType}
            playAnimations={playAnimations}
            rotation={loadingRotation}
            source={asset.source}
          />
        ) : (
          <FileImage aria-hidden="true" className={listView ? "h-5 w-5" : "h-8 w-8"} />
        )}
      </span>
      {listView ? (
        <span className="flex min-w-0 flex-1 items-center gap-1 text-sm font-medium">
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {sizeLabel ? <span className="flex-none text-xs text-canvas-muted">{sizeLabel}</span> : null}
          <AssetLibraryAssetTypeIcon asset={asset} node={node} />
        </span>
      ) : (
        <span className="mt-2 block min-w-0 text-xs font-medium">
          <span className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <AssetLibraryAssetTypeIcon asset={asset} node={node} />
          </span>
          {sizeLabel ? <span className="block text-canvas-muted">{sizeLabel}</span> : null}
        </span>
      )}
    </button>
  );
}
