import { FileImage, Folder, Link } from "lucide-react";
import type { DragEvent, PointerEvent } from "react";

import type { LibraryImageAsset, LibraryNode } from "@library/types";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import type { LibraryViewMode } from "./LibraryPanel";

type LibraryPanelNodeProps = {
  asset?: LibraryImageAsset | null;
  buttonRef?: (button: HTMLButtonElement | null) => void;
  isBackground: boolean;
  isToken: boolean;
  node: LibraryNode;
  onClick: () => void;
  onDragEnd: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onNavigate: () => void;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  viewMode: LibraryViewMode;
};

export function LibraryPanelNode({
  asset,
  buttonRef,
  isBackground,
  isToken,
  node,
  onClick,
  onDragEnd,
  onDragStart,
  onNavigate,
  onPointerDown,
  viewMode
}: LibraryPanelNodeProps) {
  const imageUrl = useResolvedImageSource(asset?.source);
  if (node.type === "folder") {
    return (
      <button
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas ${
          viewMode === "grid" ? "min-w-0 flex-col justify-center" : ""
        }`}
        onClick={onNavigate}
        type="button"
      >
        <Folder aria-hidden="true" className="h-4 w-4" />
        <span
          className={`min-w-0 truncate ${viewMode === "list" ? "flex-1" : ""}`}
        >
          {node.name}
        </span>
      </button>
    );
  }

  return (
    <button
      className={`group flex w-full touch-none select-none rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas ${
        viewMode === "grid"
          ? "min-w-0 flex-col items-stretch gap-1"
          : "items-center gap-3"
      } ${
        isToken
          ? "cursor-grab active:cursor-grabbing"
          : isBackground
            ? "cursor-pointer"
            : "cursor-default"
      }`}
      draggable={false}
      ref={buttonRef}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      type="button"
    >
      <span
        className={`flex items-center justify-center overflow-hidden rounded-lg border border-canvas-line bg-white ${
          viewMode === "grid" ? "aspect-square w-full" : "h-16 w-16 flex-none"
        }`}
      >
        {asset ? (
          <img
            alt=""
            className="h-full w-full object-cover transition duration-150 ease-out group-hover:scale-[1.2]"
            draggable={false}
            src={imageUrl ?? ""}
          />
        ) : node.type === "link" ? (
          <Link aria-hidden="true" className="h-4 w-4" />
        ) : (
          <FileImage aria-hidden="true" className="h-4 w-4" />
        )}
      </span>
      <span
        className={`min-w-0 truncate ${viewMode === "list" ? "flex-1" : ""}`}
      >
        {node.name}
      </span>
    </button>
  );
}
