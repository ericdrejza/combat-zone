import { Copy, Download, FileImage, Pencil, Trash2, X } from "lucide-react";
import type { RefObject } from "react";

import type { LibraryNode } from "@library/types";

export type ContextMenuState = {
  nodeId: string;
  x: number;
  y: number;
} | null;

export type EncounterContextMenuState = {
  encounterId: string;
  name: string;
  x: number;
  y: number;
} | null;

type EncounterContextMenuProps = {
  contextMenu: NonNullable<EncounterContextMenuState>;
  contextMenuRef: RefObject<HTMLDivElement>;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  readOnly: boolean;
};

/** Actions for encounter records are separate from asset-node actions. */
export function EncounterContextMenu({
  contextMenu,
  contextMenuRef,
  onDelete,
  onDuplicate,
  onExport,
  onRename,
  readOnly
}: EncounterContextMenuProps) {
  return (
    <div
      ref={contextMenuRef}
      className="fixed z-[60] w-40 rounded-2xl border border-canvas-line bg-white p-2 text-sm shadow-lg"
      role="menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:text-canvas-muted"
        disabled={readOnly}
        onClick={() => onRename(contextMenu.encounterId, contextMenu.name)}
        role="menuitem"
        type="button"
      >
        <Pencil aria-hidden="true" className="h-4 w-4" />
        Rename
      </button>
      <button
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:text-canvas-muted"
        disabled={readOnly}
        onClick={() => onDuplicate(contextMenu.encounterId)}
        role="menuitem"
        type="button"
      >
        <Copy aria-hidden="true" className="h-4 w-4" />
        Duplicate
      </button>
      <button
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-canvas"
        onClick={() => onExport(contextMenu.encounterId, contextMenu.name)}
        role="menuitem"
        type="button"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        Export
      </button>
      <button
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-canvas-muted"
        disabled={readOnly}
        onClick={() => onDelete(contextMenu.encounterId, contextMenu.name)}
        role="menuitem"
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}

type AssetContextMenuProps = {
  contextMenu: NonNullable<ContextMenuState>;
  contextMenuRef: RefObject<HTMLDivElement>;
  node: LibraryNode;
  onDelete: (node: LibraryNode) => void;
  onRename: (node: LibraryNode) => void;
  readOnly?: boolean;
};

export function AssetContextMenu({
  contextMenu,
  contextMenuRef,
  node,
  onDelete,
  onRename,
  readOnly = false
}: AssetContextMenuProps) {
  return (
    <div
      ref={contextMenuRef}
      className="fixed z-[60] w-36 rounded-2xl border border-canvas-line bg-white p-2 text-sm shadow-lg"
      role="menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:text-canvas-muted"
        disabled={readOnly}
        onClick={() => onRename(node)}
        role="menuitem"
        type="button"
      >
        Rename
      </button>
      <button
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-canvas-muted"
        disabled={readOnly}
        onClick={() => onDelete(node)}
        role="menuitem"
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}

type ConfirmFolderDeleteDialogProps = {
  node: LibraryNode;
  onCancel: () => void;
  onDelete: () => void;
};

export function ConfirmFolderDeleteDialog({
  node,
  onCancel,
  onDelete
}: ConfirmFolderDeleteDialogProps) {
  return (
    <div
      aria-label="Confirm folder deletion"
      aria-modal="true"
      className="viewport-overlay z-[65] flex items-center justify-center overflow-y-auto bg-black/30 p-6"
      role="dialog"
    >
      <div className="w-[min(26rem,92vw)] rounded-3xl border border-canvas-line bg-white p-5 shadow-2xl">
        <h3 className="font-display text-lg font-semibold">Delete folder?</h3>
        <p className="mt-2 text-sm text-canvas-muted">
          This folder isn't empty. Delete "{node.name}" and everything inside it?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-xl border border-canvas-line px-4 py-2 text-sm font-medium transition hover:bg-canvas"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
            onClick={onDelete}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

type AssetLinkPickerDialogProps = {
  imageNodes: LibraryNode[];
  onClose: () => void;
  onSelectAsset: (node: LibraryNode) => void;
};

export function AssetLinkPickerDialog({
  imageNodes,
  onClose,
  onSelectAsset
}: AssetLinkPickerDialogProps) {
  return (
    <div
      aria-label="Select existing asset"
      aria-modal="true"
      className="viewport-overlay z-[55] flex items-center justify-center overflow-y-auto bg-black/30 p-6"
      role="dialog"
    >
      <div className="w-[min(24rem,92vw)] rounded-3xl border border-canvas-line bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Select asset</h3>
          <button
            aria-label="Close asset picker"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {imageNodes.map((node) => (
            <button
              key={node.id}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas"
              onClick={() => onSelectAsset(node)}
              type="button"
            >
              <FileImage aria-hidden="true" className="h-4 w-4" />
              <span className="truncate">{node.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
