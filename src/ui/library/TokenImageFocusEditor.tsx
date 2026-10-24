import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { resolveLibraryAsset, setTokenImageFocus } from "@library/librarySlice";
import type { RootState } from "@store/store";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { ImageFocusDialog } from "./ImageFocusDialog";

/** Edits the resolved asset, never its aliases or existing actor snapshots. */
export function TokenImageFocusEditor({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const tokens = useSelector((state: RootState) => state.library.sections.tokens);
  const asset = resolveLibraryAsset(tokens, nodeId);
  const [sourceKey] = useState(() => JSON.stringify(asset?.source));
  const valid = Boolean(asset && JSON.stringify(asset.source) === sourceKey);
  const dispatch = useDispatch();
  const { readOnly } = usePersistence();
  useEffect(() => { if (!valid) onClose(); }, [valid, onClose]);
  if (!asset || !valid) return null;
  return <ImageFocusDialog title="Adjust token default focus" source={asset.source} mediaType={asset.mediaType}
    initialFocus={asset.imageFocus} readOnly={readOnly} onClose={onClose}
    onSave={focus => {
      if (!readOnly) dispatch(setTokenImageFocus({ sectionId: "tokens", nodeId, focus }));
      onClose();
    }} />;
}
