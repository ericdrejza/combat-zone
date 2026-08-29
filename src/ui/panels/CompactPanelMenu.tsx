import { motion } from "motion/react";
import type { KeyboardEvent, RefObject } from "react";

import type { CompactPanelDefinition, CompactPanelId } from "./compactPanelMetadata";

export type CompactPanelMenuProps = {
  highlightedIndex: number | null;
  menuRef: RefObject<HTMLDivElement>;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPanelSelect: (panelId: CompactPanelId) => void;
  onPanelHover: (index: number) => void;
  onClose: () => void;
  panels: readonly CompactPanelDefinition[];
  selectedPanelId: CompactPanelId;
};

export function CompactPanelMenu({
  highlightedIndex,
  menuRef,
  onClose,
  onKeyDown,
  onPanelHover,
  onPanelSelect,
  panels,
  selectedPanelId
}: CompactPanelMenuProps) {
  return (
    <div ref={menuRef}>
      <motion.div
        aria-label="Choose panel"
        className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-2 flex flex-col gap-1 rounded-2xl border border-canvas-line bg-canvas-panel/95 p-2 shadow-xl backdrop-blur"
        initial={{ opacity: 0, y: 12, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.94 }}
        onKeyDown={onKeyDown}
        role="menu"
      >
        {panels.map((panel, index) => {
          const Icon = panel.Icon;
          const highlighted = highlightedIndex === index;
          return (
            <div className="flex flex-col items-center gap-1" key={panel.id}>
              <motion.button
                aria-label={panel.title}
                aria-pressed={selectedPanelId === panel.id}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border text-canvas-ink transition ${
                  highlighted || selectedPanelId === panel.id
                    ? "border-canvas-ink bg-canvas"
                    : "border-transparent hover:bg-canvas"
                }`}
                data-compact-panel-item
                onClick={() => {
                  onPanelSelect(panel.id);
                  onClose();
                }}
                onPointerEnter={() => onPanelHover(index)}
                role="menuitem"
                type="button"
                whileHover={{ scale: 1.08 }}
                animate={{ scale: highlighted ? 1.08 : 1 }}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </motion.button>
              {highlighted ? (
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-20 truncate text-center text-xs font-medium text-canvas-ink"
                  initial={{ opacity: 0, y: -2 }}
                >
                  {panel.title}
                </motion.span>
              ) : null}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
