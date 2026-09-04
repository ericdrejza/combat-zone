import { useSelector } from "react-redux";

import { getLibraryNodePath } from "@library/librarySlice";
import { isWebImageSource } from "@library/webImageAsset";
import { directImageSourceUrl } from "@core/assets/imageAssetSource";
import type { RootState } from "@store/store";
import { getFileNameWithoutExtension } from "@library/fileName";

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

export function BackgroundPropertiesPanel() {
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
        <ReadOnlyBackgroundField label="Library Path" value={libraryPath} />
      ) : null}
      {url ? <ReadOnlyBackgroundField label="URL" value={url} /> : null}
    </div>
  );
}
