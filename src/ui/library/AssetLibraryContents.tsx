import { FileImage, Folder, Link } from "lucide-react";
import { useTime, useTransform } from "motion/react";
import type { DragEvent } from "react";

import type { LibraryNode, LibrarySection } from "@library/types";
import { LIBRARY_NODE_DRAG_TYPE } from "./libraryDrag";
import { getAlphabetizedChildren } from "./libraryUi";
import { AssetImagePreview } from "./AssetImagePreview";

type AssetLibraryContentsProps = {
  activeSection: LibrarySection;
  currentFolder: LibraryNode;
  dropFolderId: string | null;
  selectedNodeId: string | undefined;
  onDragEnd: () => void;
  onDragOverContents: (event: DragEvent<HTMLElement>) => void;
  onDragOverFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onDragStart: (event: DragEvent<HTMLElement>, node: LibraryNode) => void;
  onDropOnContents: (event: DragEvent<HTMLElement>) => void;
  onDropOnFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onDoubleClickNode: (node: LibraryNode) => void;
  onEnterFolder: (folderId: string) => void;
  onOpenContextMenu: (
    event: {
      clientX: number;
      clientY: number;
      preventDefault: () => void;
    },
    node: LibraryNode
  ) => void;
  onSelectNode: (nodeId: string) => void;
  setDropFolderId: (folderId: string | null) => void;
};

export function AssetLibraryContents({
  activeSection,
  currentFolder,
  dropFolderId,
  selectedNodeId,
  onDragEnd,
  onDragOverContents,
  onDragOverFolder,
  onDragStart,
  onDropOnContents,
  onDropOnFolder,
  onDoubleClickNode,
  onEnterFolder,
  onOpenContextMenu,
  onSelectNode,
  setDropFolderId
}: AssetLibraryContentsProps) {
  const time = useTime();
  const loadingRotation = useTransform(time, (milliseconds) =>
    `rotate(${(milliseconds / 1000) * 360}deg)`
  );

  return (
    <section
      aria-label="Asset library contents"
      className="min-h-0 overflow-auto p-5"
      onDragLeave={() => setDropFolderId(null)}
      onDragOver={onDragOverContents}
      onDrop={onDropOnContents}
    >
      <div
        aria-label="Current asset library folder"
        className="mb-4 flex items-center gap-2 border-b border-canvas-line pb-3 text-sm font-semibold text-canvas-ink"
      >
        <Folder aria-hidden="true" className="h-4 w-4" />
        <span className="min-w-0 truncate">{currentFolder.name}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
        {getAlphabetizedChildren(activeSection, currentFolder.id).map((node) => {
          const selected = selectedNodeId === node.id;

          return (
            <button
              key={node.id}
              aria-label={node.name}
              aria-pressed={selected}
              className={`rounded-2xl border bg-white p-2 text-left transition hover:bg-canvas ${
                dropFolderId === node.id
                  ? "border-canvas-ink bg-canvas ring-2 ring-canvas-ink/20"
                  : selected
                    ? "border-canvas-ink ring-2 ring-canvas-ink/20"
                    : "border-canvas-line"
              }`}
              draggable
              onClick={() => {
                if (node.type === "folder") {
                  onEnterFolder(node.id);
                  return;
                }

                onSelectNode(node.id);
              }}
              onContextMenu={(event) => onOpenContextMenu(event, node)}
              onDoubleClick={() => onDoubleClickNode(node)}
              onDragEnd={onDragEnd}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(LIBRARY_NODE_DRAG_TYPE, node.id);
                event.dataTransfer.setData("text/plain", node.id);
                onDragStart(event, node);
              }}
              onDragOver={(event) => {
                if (node.type === "folder") {
                  onDragOverFolder(event, node);
                }
              }}
              onDrop={(event) => {
                if (node.type === "folder") {
                  onDropOnFolder(event, node);
                }
              }}
              type="button"
            >
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-canvas">
                {node.type === "folder" ? (
                  <Folder aria-hidden="true" className="h-10 w-10 text-canvas-muted" />
                ) : node.type === "link" ? (
                  <Link aria-hidden="true" className="h-8 w-8 text-canvas-muted" />
                ) : (
                  node.asset ? (
                    <AssetImagePreview
                      name={node.name}
                      rotation={loadingRotation}
                      src={node.asset.dataUrl}
                    />
                  ) : (
                    <FileImage aria-hidden="true" className="h-8 w-8 text-canvas-muted" />
                  )
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium">{node.name}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
