import { Pipette, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

const ACTION = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-canvas-line bg-canvas-surface enabled:hover:bg-canvas enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40";
type DropperWindow = Window & { EyeDropper?: new () => { open: (options: { signal: AbortSignal }) => Promise<{ sRGBHex: string }> } };

export function ColorResetButton({ label, onReset, disabled = false }: { label: string; onReset: () => void; disabled?: boolean }) {
  const title = `Reset ${label.toLowerCase()} to default`;
  return <TouchTooltip label={title}><button type="button" className={ACTION} title={title} aria-label={title} disabled={disabled} onClick={onReset}>
    <RotateCcw aria-hidden="true" className="h-4 w-4" />
  </button></TouchTooltip>;
}

/** Feature detection keeps unsupported browsers usable; cancellation leaves the color unchanged. */
export function ColorDropperButton({ label, onChange, disabled = false }: { label: string; onChange: (color: string) => void; disabled?: boolean }) {
  const button = useRef<HTMLButtonElement>(null);
  const active = useRef<AbortController | null>(null);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setSupported(Boolean((button.current?.ownerDocument.defaultView as DropperWindow | null)?.EyeDropper));
    return () => active.current?.abort();
  }, []);
  const title = supported ? `Pick ${label.toLowerCase()} from screen` : "Screen color picker is unavailable in this browser";
  return <div className="space-y-1">
    <TouchTooltip label={title}><button ref={button} type="button" className={ACTION} title={title} aria-label={`Pick ${label.toLowerCase()} from screen`} disabled={disabled || !supported || busy}
      onClick={async () => {
        const Dropper = (button.current?.ownerDocument.defaultView as DropperWindow | null)?.EyeDropper;
        if (!Dropper) return;
        const controller = new AbortController();
        active.current = controller;
        setBusy(true); setError(false);
        try {
          const result = await new Dropper().open({ signal: controller.signal });
          if (!controller.signal.aborted && /^#[0-9a-f]{6}$/i.test(result.sRGBHex)) onChange(result.sRGBHex.toLowerCase());
        } catch (cause) {
          if (!controller.signal.aborted && (cause as { name?: string }).name !== "AbortError") setError(true);
        } finally { if (!controller.signal.aborted) setBusy(false); }
      }}><Pipette aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>
    {error ? <p role="status" className="text-xs text-canvas-muted">Could not pick a screen color. Try again.</p> : null}
  </div>;
}
