import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { StatusTooltipPopup } from "@ui/status/StatusTooltipPopup";

/** Missing entities retain their historical appearance; activation only explains why navigation is unavailable. */
export function StaleReference({ text, color }: { text: string; color: string | null }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || !anchor.current) return;
    const owner = anchor.current.ownerDocument;
    const dismiss = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    owner.addEventListener("pointerdown", dismiss);
    return () => owner.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return <>
    <button ref={anchor} type="button" aria-describedby={open ? id : undefined}
      className="inline cursor-pointer rounded-sm text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink"
      style={{ color: color ?? "rgb(var(--color-canvas-ink))" }} onClick={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>{text}</button>
    {open && anchor.current ? <StatusTooltipPopup anchor={anchor.current} id={id} placement="bottom" tone="warning"
      label={<span className="inline-flex items-center gap-1"><TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />Stale reference</span>} /> : null}
  </>;
}
