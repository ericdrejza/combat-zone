import { useEffect, useRef, type ReactNode } from "react";

/** Contains keyboard focus and restores it when a resource dialog closes. */
export function StatusDialog({ title, onClose, children, cancelOnBackdrop = false }: { title: string; onClose: () => void; children: ReactNode; cancelOnBackdrop?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    (dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus="true"]') ?? dialog?.querySelector<HTMLElement>("input, button, select"))?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="viewport-overlay z-[85] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={(event) => {
    event.stopPropagation();
    if (cancelOnBackdrop && event.target === event.currentTarget) onClose();
  }}>
    <div aria-label={title} aria-modal="true" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-xl" ref={ref} role="dialog" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('input, select, button:not(:disabled), [tabindex="0"]') ?? []);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <h3 className="mb-3 font-display text-lg font-semibold">{title}</h3>
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
      <button className="rounded-xl border border-canvas-line px-3 py-2 enabled:hover:bg-canvas-surface" onClick={onClose} type="button">Cancel</button>
      <button data-dialog-initial-focus={focusConfirm || undefined} className="rounded-xl bg-canvas-ink px-3 py-2 text-canvas-on-ink enabled:hover:bg-canvas-ink/80" onClick={onConfirm} type="button">{confirmLabel}</button>
    </div>
  </StatusDialog>;
}
