import { FolderPlus, Link, Plus, Upload } from "lucide-react";
import type { RefObject } from "react";

type AssetLibraryAddMenuProps = {
  addMenuOpen: boolean;
  addMenuRef: RefObject<HTMLDivElement>;
  canLinkAssets: boolean;
  canUploadAssets: boolean;
  sectionName: string;
  onCreateFolder: () => void;
  onOpenFilePicker: () => void;
  onOpenFolderPicker: () => void;
  onOpenLinkPicker: () => void;
  onToggleAddMenu: () => void;
};

export function AssetLibraryAddMenu({
  addMenuOpen,
  addMenuRef,
  canLinkAssets,
  canUploadAssets,
  sectionName,
  onCreateFolder,
  onOpenFilePicker,
  onOpenFolderPicker,
  onOpenLinkPicker,
  onToggleAddMenu
}: AssetLibraryAddMenuProps) {
  return (
    <div className="relative" ref={addMenuRef}>
      <button
        aria-expanded={addMenuOpen}
        aria-haspopup="menu"
        aria-label={`Add to ${sectionName}`}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-ink transition hover:bg-canvas"
        onClick={onToggleAddMenu}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
      {addMenuOpen ? (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-canvas-line bg-white p-2 text-sm shadow-lg"
          role="menu"
        >
          <button
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:text-canvas-muted"
            disabled={!canUploadAssets}
            onClick={onOpenFilePicker}
            role="menuitem"
            type="button"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            Upload new image
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:text-canvas-muted"
            disabled={!canUploadAssets}
            onClick={onOpenFolderPicker}
            role="menuitem"
            type="button"
          >
            <FolderPlus aria-hidden="true" className="h-4 w-4" />
            Upload folder
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-canvas"
            onClick={onCreateFolder}
            role="menuitem"
            type="button"
          >
            <FolderPlus aria-hidden="true" className="h-4 w-4" />
            Create new folder
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:text-canvas-muted"
            disabled={!canLinkAssets}
            onClick={onOpenLinkPicker}
            role="menuitem"
            type="button"
          >
            <Link aria-hidden="true" className="h-4 w-4" />
            Link existing asset
          </button>
        </div>
      ) : null}
    </div>
  );
}
