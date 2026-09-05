import { useSelector } from "react-redux";

import { getLibraryNodePath } from "@library/librarySlice";
import { isWebImageSource } from "@library/webImageAsset";
import { directImageSourceUrl } from "@core/assets/imageAssetSource";
import type { RootState } from "@store/store";
import { getFileNameWithoutExtension } from "@library/fileName";
import type { PropertiesLibraryLocation } from "./PropertiesPanel";

type ReadOnlyBackgroundFieldProps = {
  label: string;
  onClick?: () => void;
  value: string;
};

function ReadOnlyBackgroundField({
  label,
  onClick,
  value
}: ReadOnlyBackgroundFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="font-semibold text-canvas-ink">{label}</span>
      <input
        className="w-full rounded-xl border border-canvas-line bg-canvas px-3 py-2 text-canvas-ink"
        onClick={onClick}
        readOnly
        type="text"
        value={value}
      />
    </label>
  );
}

type BackgroundPropertiesPanelProps = {
  onOpenLibraryLocation?: (location: PropertiesLibraryLocation) => void;
};

export function BackgroundPropertiesPanel({
  onOpenLibraryLocation
}: BackgroundPropertiesPanelProps) {
  const backgroundImage = useSelector(
    (state: RootState) => state.encounter.present.backgroundImage
  );
  const backgrounds = useSelector(
    (state: RootState) => state.library.sections.backgrounds
  );

  if (!backgroundImage) {
    return (
      <p className="text-sm text-canvas-muted">
        Add a background image to inspect its source.
      </p>
    );
  }

  const libraryPath = backgroundImage.libraryNodeId
    ? getLibraryNodePath(backgrounds, backgroundImage.libraryNodeId)
    : null;
  const libraryNode = backgroundImage.libraryNodeId
    ? backgrounds.nodesById[backgroundImage.libraryNodeId]
    : null;
  const libraryFolderId =
    libraryNode?.parentId && backgrounds.nodesById[libraryNode.parentId]?.type === "folder"
      ? libraryNode.parentId
      : backgrounds.rootId;
  const sourceUrl = directImageSourceUrl(backgroundImage.source);
  const url = sourceUrl && isWebImageSource(sourceUrl)
    ? sourceUrl
    : null;

  return (
    <div className="space-y-4 text-sm">
      <ReadOnlyBackgroundField
        label="Name"
        value={getFileNameWithoutExtension(backgroundImage.name)}
      />
      {libraryPath ? (
        <ReadOnlyBackgroundField
          label="Library Path"
          onClick={() =>
            onOpenLibraryLocation?.({
              folderId: libraryFolderId,
              sectionId: "backgrounds"
            })
          }
          value={libraryPath}
        />
      ) : null}
      {url ? <ReadOnlyBackgroundField label="URL" value={url} /> : null}
    </div>
  );
}
