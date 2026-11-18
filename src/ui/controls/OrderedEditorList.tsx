import { useOrderedEditorAutoScroll } from "./useOrderedEditorAutoScroll";
import { Reorder, useDragControls } from "motion/react";
import { ArrowDown, ArrowUp, GripVertical, Pencil } from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { TooltipIconButton } from "./TooltipIconButton";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";

type Item = { id: string; name: string; dirty?: boolean };
/** One ordering interaction for saved-list editors: touch/pointer handles plus accessible move buttons. */
export function OrderedEditorList({ items, onReorder, onSelect, selectedId, disabled = false }: { items: Item[]; onReorder: (ids: string[]) => void; onSelect?: (id: string) => void; selectedId?: string; disabled?: boolean }) {
  const { animationsDisabled } = useMotionPreference();
  const ids = items.map(item => item.id);
  const autoScroll = useOrderedEditorAutoScroll(ids, onReorder, disabled);
  if (items.length === 0) return null;
  function move(index: number, delta: number) {
    const next = [...ids]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onReorder(next);
  }
  return <Reorder.Group ref={autoScroll.listRef} as="ol" layoutScroll axis="y" values={ids} onReorder={onReorder} aria-label="Item order" className="relative my-2 min-h-0 max-h-52 space-y-1 overflow-y-auto">
    {items.map((item, i) => <OrderRow key={item.id} item={item} autoScroll={autoScroll} selected={selectedId === item.id} disabled={disabled} reduced={animationsDisabled} onSelect={onSelect} first={i === 0} last={i === items.length - 1} onMove={delta => move(i, delta)} />)}
  </Reorder.Group>;
}
function OrderRow({ item, autoScroll, selected, disabled, reduced, first, last, onMove, onSelect }: { item: Item; autoScroll: ReturnType<typeof useOrderedEditorAutoScroll>; selected: boolean; disabled: boolean; reduced: boolean; first: boolean; last: boolean; onMove: (delta: number) => void; onSelect?: (id: string) => void }) {
  const controls = useDragControls();
  return <Reorder.Item data-order-id={item.id} onDragStart={autoScroll.start} onDragEnd={autoScroll.stop} value={item.id} dragListener={false} dragControls={controls} layout={reduced ? undefined : "position"} className={`flex items-center gap-1 rounded-lg border p-1 ${selected ? "border-canvas-ink" : "border-canvas-line"}`}>
    <TooltipIconButton label={`Reorder ${item.name}`} disabled={disabled} style={{ touchAction: "none" }} onPointerDown={e => { if (autoScroll.prepare(item.id, e)) controls.start(e); }}><GripVertical className="h-4 w-4" /></TooltipIconButton>
    {onSelect ? <button type="button" disabled={disabled} aria-pressed={selected} aria-description={item.dirty ? "Unsaved changes" : undefined} value={item.id} className="flex min-w-0 flex-1 items-center gap-1 break-words rounded p-1 text-left enabled:hover:bg-canvas-surface focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:opacity-40" onClick={() => onSelect(item.id)}><span className="min-w-0 break-words">{item.name}</span>{item.dirty ? <TouchTooltip label="Unsaved changes"><Pencil aria-hidden="true" className="h-3 w-3 shrink-0" /></TouchTooltip> : null}</button> : <span className="min-w-0 flex-1 break-words">{item.name}</span>}
    <TooltipIconButton label={`Move ${item.name} up`} disabled={disabled || first} onClick={() => onMove(-1)}><ArrowUp className="h-3 w-3" /></TooltipIconButton>
    <TooltipIconButton label={`Move ${item.name} down`} disabled={disabled || last} onClick={() => onMove(1)}><ArrowDown className="h-3 w-3" /></TooltipIconButton>
  </Reorder.Item>;
}
