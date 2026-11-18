import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import type { Actor } from "@entities/actor/types";
import { invocationText } from "@core/dice/resolveInvocation";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { DICE_BUTTON } from "./DiceIconButton";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { RollableTooltip } from "./RollableTooltip";
import { RollablesEditor } from "./RollablesEditor";
import { useSendDiceMessage } from "./useSendDiceMessage";
export function ActorRollables({ actor }: { actor: Actor }) {
  const [editing, setEditing] = useState<"edit" | "add" | null>(null);
  const [error, setError] = useState("");
  const { readOnly } = usePersistence();
  const { send, busy, checkModeDialog } = useSendDiceMessage();
  return <section aria-label="Rollables" className="space-y-2 border-t border-canvas-line pt-3"><div className="flex items-center justify-between"><h3 className="font-semibold">Rollables</h3><div className="flex items-center gap-1"><TouchTooltip label="Edit Rollables"><button type="button" aria-label="Edit Rollables" title="Edit Rollables" disabled={readOnly || busy} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setEditing("edit")}><Pencil aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip><TouchTooltip label="Add Rollable"><button type="button" aria-label="Add Rollable" title="Add Rollable" disabled={readOnly || busy} className="rounded p-2 enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40" onClick={() => setEditing("add")}><Plus aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip></div></div>
    <div className="flex flex-wrap gap-2">{actor.rollables?.allIds.map(id => <RollableTooltip key={id} rollable={actor.rollables!.byId[id]}><button type="button" className={DICE_BUTTON} disabled={readOnly || busy} onClick={async () => {
      setError(""); try { await send(invocationText(actor.name, actor.rollables!.byId[id].name), { source: actor.id, rollable: id }); } catch (error) { setError(error instanceof Error ? error.message : "Roll failed."); }
    }}>{actor.rollables!.byId[id].name}</button></RollableTooltip>)}</div>
    {checkModeDialog}
    {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    {editing ? <RollablesEditor actor={actor} createOnOpen={editing === "add"} onClose={() => setEditing(null)} /> : null}
  </section>;
}
