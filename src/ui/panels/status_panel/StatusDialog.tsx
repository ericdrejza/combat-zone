import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Contains keyboard focus and restores it when a resource dialog closes. */
export function StatusDialog({ title, onClose, children, cancelOnBackdrop = false, showClose = false, titleContent, compact = false, closeAboveTitle = false }: { title: string; onClose: () => void; children: ReactNode; cancelOnBackdrop?: boolean; showClose?: boolean; titleContent?: ReactNode; compact?: boolean; closeAboveTitle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    (dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus="true"]') ?? dialog?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled), select:not(:disabled)"))?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="viewport-overlay z-[85] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={(event) => {
    event.stopPropagation();
    if (cancelOnBackdrop && event.target === event.currentTarget) onClose();
  }}>
    <div aria-label={title} aria-modal="true" className={`max-h-[90vh] ${compact ? "w-fit max-w-[min(20rem,100%)]" : "w-full max-w-md"} overflow-y-auto rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-xl`} ref={ref} role="dialog" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled), [tabindex="0"]') ?? []);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className={`mb-3 flex ${closeAboveTitle ? "flex-col" : "items-start"} gap-2`}>
      <h3 className={`min-w-0 font-display text-lg font-semibold ${closeAboveTitle ? "w-full" : "flex-1"}`}>{titleContent ?? title}</h3>
      {showClose ? <button aria-label="Close dialog" className={`shrink-0 rounded p-1 hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink ${closeAboveTitle ? "order-first self-end" : ""}`} onClick={onClose} type="button"><X aria-hidden="true" className="h-4 w-4" /></button> : null}
      </div>
      {children}
    </div>
  </div>;
}
export function ConfirmStatusDialog({ title, children, confirmLabel = "Confirm", focusConfirm = false, onConfirm, onClose }: {
  title: string; children: ReactNode; confirmLabel?: string; focusConfirm?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return <StatusDialog title={title} onClose={onClose} cancelOnBackdrop>
    {children}
    <div className="mt-4 flex justify-end gap-2">
      <button className="rounded-xl border border-canvas-line px-3 py-2 enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink" onClick={onClose} type="button">Cancel</button>
      <button data-dialog-initial-focus={focusConfirm || undefined} className="rounded-xl bg-canvas-ink px-3 py-2 text-canvas-on-ink enabled:hover:bg-canvas-ink/80 focus-visible:ring-2 focus-visible:ring-canvas-ink" onClick={onConfirm} type="button">{confirmLabel}</button>
    </div>
  </StatusDialog>;
}
