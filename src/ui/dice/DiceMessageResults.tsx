import { DiceTotal } from "./DiceTotal";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { useDicePresentation } from "./dicePreferences";
import type { ChatMessage } from "@core/chat/types";
import { DiceResultTree } from "./DiceResultTree";
import { RollApplicationControls } from "./RollApplicationControls";
import { RollResolution } from "./RollResolution";

export function DiceMessageResults({ message }: { message: ChatMessage }) {
  const mode = useDicePresentation();
  const receipts = useSelector((s: RootState) => s.encounter.present.rollApplications);
  const applied = new Set(receipts.allIds.map(id => receipts.byId[id]).filter(receipt => message.rolls?.some(result => result.id === receipt.resultId)).map(receipt => receipt.actorId)).size;
  return <div className="space-y-2" aria-live="polite">{message.rolls?.map(result => <section key={result.id} aria-label={`Roll result: ${result.formula}`} className="mt-2 min-w-0 border-t border-canvas-line pt-2 text-canvas-ink">
    {result.targetId ? <p className="break-words text-sm font-semibold">{message.invocation?.targets.find(target => target.id === result.targetId)?.name}</p> : null}
    <p className="break-words font-mono text-xs">{result.formula}</p>
    <div className="my-1"><DiceResultTree node={result.node} image={mode === "images"} /></div>
    {result.auxiliary?.length ? <div className="text-xs text-canvas-muted">Rule calculations: {result.auxiliary.map((node, i) => <div key={i}><DiceResultTree node={node} image={mode === "images"} /> = {node.value}</div>)}</div> : null}
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
    <DiceTotal result={result} invocation={message.invocation} />
    {result.outcome === "sum" && result.role !== "check" && message.invocation?.rollable.effectKind !== "none" ? <RollApplicationControls message={message} result={result} /> : null}
    </div>
    {result.presentationNote ? <p className="text-xs text-canvas-muted">{result.presentationNote}</p> : null}
    {result.capped ? <p className="text-xs text-amber-700 dark:text-amber-400">Extra-roll limit reached; keeping the results so far. Use ~m after a repeating modifier to change its maximum extra rolls, for example d6!~5. See Settings → Dice.</p> : null}
  </section>)}{message.invocation?.phase === "pending" ? <RollResolution message={message} /> : null}{applied ? <p className="pt-2 text-center text-xs text-canvas-muted">Applied to {applied} target{applied === 1 ? "" : "s"}</p> : null}</div>;
}
