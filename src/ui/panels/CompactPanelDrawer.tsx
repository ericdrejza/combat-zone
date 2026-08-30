import { motion } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import type { CompactPanelDefinition } from "./compactPanelMetadata";

export type CompactPanelDrawerProps = {
  panel: CompactPanelDefinition;
  onClose: () => void;
  renderPanelContent?: (panel: CompactPanelDefinition) => ReactNode;
  renderPanelHeaderActions?: (panel: CompactPanelDefinition) => ReactNode;
};

export function CompactPanelDrawer({
  onClose,
  panel,
  renderPanelContent,
  renderPanelHeaderActions
}: CompactPanelDrawerProps) {
  return (
    <motion.aside
      aria-label={`${panel.title} panel`}
      aria-modal="true"
      className="pointer-events-auto absolute inset-y-0 right-0 flex w-[min(24rem,calc(100vw-3.5rem))] max-w-[24rem] flex-col border-l border-canvas-line bg-canvas-panel shadow-2xl [padding-bottom:calc(env(safe-area-inset-bottom)+4.5rem)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-canvas-line px-4">
        <h2 className="font-display text-lg font-semibold">{panel.title}</h2>
        <div className="flex items-center gap-1">
          {renderPanelHeaderActions?.(panel)}
          <button
            aria-label={`Close ${panel.title} panel`}
            autoFocus
            className="flex h-9 w-9 items-center justify-center rounded-full text-canvas-muted transition hover:bg-white"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {renderPanelContent?.(panel) ?? (
          <p className="text-sm text-canvas-muted">{panel.title} panel</p>
        )}
      </div>
    </motion.aside>
  );
}
