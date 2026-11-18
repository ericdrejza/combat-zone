import { ArrowDownAZ, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { OrderedEditorList } from "./OrderedEditorList";
import { useEditorMenuPosition } from "./useEditorMenuPosition";
import { TooltipIconButton } from "./TooltipIconButton";

type Item = { id: string; name: string; dirty?: boolean };
export type OrderedEditorSelectProps = {
  label: string; placeholder?: string; items: Item[]; selectedId?: string; disabled?: boolean;
  createLabel: string; onCreate: () => void;
  onSelect: (id: string) => void; onReorder: (ids: string[]) => void;
};

/** The popup overlays the editor and contains drag scrolling; ordering leaves it open. */
export function OrderedEditorSelect({ label, placeholder = "Select an item", items, selectedId, disabled = false, createLabel, onCreate, onSelect, onReorder }: OrderedEditorSelectProps) {
  const [open, setOpen] = useState(false);
  const popupId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const position = useEditorMenuPosition(trigger, open && !disabled);
  const selected = items.find(item => item.id === selectedId);
  const ready = open && !disabled && position !== null;

  useEffect(() => {
    if (!ready) return;
    (popup.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      popup.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
  }, [ready]);

  function close() { setOpen(false); trigger.current?.focus(); }
  const menu = ready ? <div className="fixed inset-0 z-[95]" onPointerDown={event => {
    event.stopPropagation();
    if (event.target === event.currentTarget) event.preventDefault();
  }} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
    <div ref={popup} id={popupId} role="dialog" aria-modal="true" aria-label={label}
      style={position} className="fixed flex min-h-0 flex-col overflow-x-hidden overflow-y-auto rounded-xl border border-canvas-line bg-canvas-panel p-2 shadow-xl overscroll-contain"
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key !== "Tab") return;
        event.stopPropagation();
        const controls = Array.from(popup.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const first = controls[0], last = controls.at(-1);
        const focused = popup.current?.ownerDocument.activeElement;
        if (event.shiftKey && focused === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && focused === last) { event.preventDefault(); first?.focus(); }
      }}>
      <OrderedEditorList items={items} selectedId={selectedId} onSelect={id => { onSelect(id); close(); }} onReorder={onReorder} />
      <div className="flex shrink-0 items-center gap-1">
      <button type="button" className="min-w-0 flex-1 rounded-lg p-2 text-left hover:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
        onClick={() => { onCreate(); close(); }}>{createLabel}</button>
      <TooltipIconButton label="Sort alphabetically" disabled={items.length < 2} onClick={() => onReorder([...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map(item => item.id))}>
        <ArrowDownAZ aria-hidden="true" className="h-4 w-4" />
      </TooltipIconButton>
      </div>
    </div>
  </div> : null;
  if (!items.length) return <button type="button" disabled={disabled} onClick={onCreate}
    className="w-full rounded-lg border border-canvas-line p-2 text-left enabled:hover:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40">{createLabel}</button>;
  return <div className="min-w-0">
    <span className="mb-1 block text-sm">{label}</span>
    <button ref={trigger} type="button" role="combobox" value={selectedId ?? ""} aria-label={label} aria-expanded={open && !disabled}
      aria-controls={popupId} aria-haspopup="dialog" disabled={disabled}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-canvas-line bg-canvas p-2 text-left enabled:hover:border-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40"
      onClick={() => setOpen(!open)} onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>
      <span className="min-w-0 break-words">{selected?.name ?? placeholder}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
    </button>
    {menu && trigger.current ? createPortal(menu, trigger.current.ownerDocument.body) : null}
  </div>;
}
