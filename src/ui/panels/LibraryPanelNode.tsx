import { FileImage, Folder, Link } from "lucide-react";
import type { DragEvent, PointerEvent } from "react";

import type { LibraryImageAsset, LibraryNode } from "@library/types";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import { isAnimatedAsset, isVideoAsset } from "@library/mediaAsset";
import { AssetLibraryAssetTypeIcon } from "@ui/library/AssetLibraryAssetTypeIcon";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ControlledVideo } from "@core/rendering/ControlledVideo";
import { useStillImageSource } from "@core/assets/useStillImageSource";
import type { LibraryViewMode } from "./LibraryPanel";

type LibraryPanelNodeProps = {
  asset?: LibraryImageAsset | null;
  buttonRef?: (button: HTMLButtonElement | null) => void;
  isBackground: boolean;
  isToken: boolean;
  node: LibraryNode;
  onClick: () => void;
  onDragEnd: () => void;
  onDragStart: (event: DragEvent<HTMLElement>, imageUrl: string | null) => void;
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
  const { enableAssetAnimation } = useInterfacePreferences();
  const videoAsset = Boolean(asset && isVideoAsset(asset));
  const animatedAsset = Boolean(
    asset && (videoAsset || isAnimatedAsset(asset))
  );
  const freezeAsset = animatedAsset && !enableAssetAnimation;
  const stillImageUrl = useStillImageSource(
    imageUrl,
    freezeAsset,
    videoAsset ? "video" : "image"
  );
  const displayedImageUrl = freezeAsset ? stillImageUrl : imageUrl;
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
      onDragStart={(event) => onDragStart(event, imageUrl)}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      type="button"
    >
      <span
        className={`flex items-center justify-center overflow-hidden rounded-lg border border-canvas-line bg-canvas-surface ${
          viewMode === "grid" ? "aspect-square w-full" : "h-16 w-16 flex-none"
        }`}
      >
        {asset ? (
          videoAsset && enableAssetAnimation ? (
            <ControlledVideo
              className="h-full w-full object-cover transition duration-150 ease-out group-hover:scale-[1.2]"
              play={enableAssetAnimation}
              src={imageUrl ?? ""}
            />
          ) : (
            <img
              alt=""
              className="h-full w-full object-cover transition duration-150 ease-out group-hover:scale-[1.2]"
              draggable={false}
              src={displayedImageUrl ?? ""}
            />
          )
        ) : node.type === "link" ? (
          <Link aria-hidden="true" className="h-4 w-4" />
        ) : (
          <FileImage aria-hidden="true" className="h-4 w-4" />
        )}
      </span>
      <span
        className={`flex min-w-0 items-center gap-1 ${viewMode === "list" ? "flex-1" : ""}`}
      >
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <AssetLibraryAssetTypeIcon asset={asset} node={node} />
      </span>
    </button>
  );
}
