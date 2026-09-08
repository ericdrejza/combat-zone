import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { getLibraryNodePath } from "@library/librarySlice";
import { isWebImageSource } from "@library/webImageAsset";
import { directImageSourceUrl } from "@core/assets/imageAssetSource";
import type { RootState } from "@store/store";
import { commitEncounterChange } from "@store/encounterSlice";
import { getFileNameWithoutExtension } from "@library/fileName";
import type { PropertiesLibraryLocation } from "./PropertiesPanel";
import { LibraryPathField } from "./LibraryPathField";

type ReadOnlyBackgroundFieldProps = {
  label: string;
  value: string;
};

function ReadOnlyBackgroundField({
  label,
  value
}: ReadOnlyBackgroundFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="font-semibold text-canvas-ink">{label}</span>
      <input
        className="w-full rounded-xl border border-canvas-line bg-canvas px-3 py-2 text-canvas-ink"
        readOnly
        type="text"
        value={value}
      />
    </label>
  );
}

type EditableBackgroundNameFieldProps = {
  onRename: (name: string) => void;
  value: string;
};

function EditableBackgroundNameField({
  onRename,
  value
}: EditableBackgroundNameFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="font-semibold text-canvas-ink">Name</span>
      <input
        key={value}
        aria-label="Name"
        className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-canvas-ink"
        defaultValue={value}
        onBlur={(event) => {
          const name = event.currentTarget.value.trim();
          onRename(name);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        type="text"
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
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
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
  const currentBackgroundImage = backgroundImage;

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
  const displayName = getFileNameWithoutExtension(backgroundImage.name);

  function renameBackground(name: string) {
    if (name === displayName) return;

    dispatch(commitEncounterChange({
      action: createEncounterActionRecord("background.rename", {
        backgroundImageName: name
      }),
      nextEncounter: {
        ...encounter,
        backgroundImage: {
          ...currentBackgroundImage,
          name
        }
      }
    }));
  }

  return (
    <div className="space-y-4 text-sm">
      {url && !libraryPath ? (
        <EditableBackgroundNameField
          onRename={renameBackground}
          value={displayName}
        />
      ) : (
        <ReadOnlyBackgroundField label="Name" value={displayName} />
      )}
      {libraryPath ? (
        <LibraryPathField
          onOpen={() =>
            onOpenLibraryLocation?.({
              folderId: libraryFolderId,
              nodeId: backgroundImage.libraryNodeId,
              sectionId: "backgrounds"
            })
          }
          value={libraryPath}
        />
      ) : null}
      {url && !libraryPath ? (
        <ReadOnlyBackgroundField label="URL" value={url} />
      ) : null}
    </div>
  );
}
