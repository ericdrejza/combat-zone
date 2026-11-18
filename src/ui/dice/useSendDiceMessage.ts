import { checkRollSetup } from "@core/dice/checkRolls";
import { LOCAL_CHAT_SENDER_ID } from "@core/chat/types";
import { useCheckRollChoice } from "./useCheckRollChoice";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { isRollInvocation } from "@core/dice/referenceSyntax";
import { useEffect, useRef, useState } from "react";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "@store/store";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { sendChatMessage } from "@store/encounterSlice";
import { messageFormulas } from "@core/dice/messageFormulas";
import { parseDiceFormula } from "@core/dice/parser";
import { rollFormulas } from "@core/dice/workerClient";
import type { DiceResult } from "@core/dice/types";
import { resolveInvocation, type MentionBindings } from "@core/dice/resolveInvocation";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { playRollableAudio } from "./rollableAudio";
import { rollWithPresentation } from "./rollWithPresentation";
import { requestRollResolution } from "./resolutionRequests";

/** One submission is all-or-nothing and bound to the encounter session that launched it. */
export function useSendDiceMessage() {
  const store = useStore<RootState>();
  const encounterSession = useSelector((s: RootState) => s.encounterLog.encounterSession);
  const { choose, dialog: checkModeDialog } = useCheckRollChoice();
  const { chatNameColor } = useInterfacePreferences();
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => () => active.current?.abort(), [encounterSession]);
  function send(message: string, bindings: MentionBindings = {}): boolean | Promise<boolean> {
    if (!message.trim() || active.current || !isPersistenceWritable()) return false;
    const leading = message.length - message.trimStart().length;
    const normalizedBindings: MentionBindings = {};
    for (const [key, id] of Object.entries(bindings)) {
      const match = key.match(/^mention:(\d+)(.*)$/);
      const start = match ? Number(match[1]) - leading : 0;
      normalizedBindings[match ? `${start === 0 ? "source" : `mention:${start}`}${match[2]}` : key] = id;
    }
    const state = store.getState();
    const encounter = state.encounter.present;
    const session = state.encounterLog.encounterSession;
    const invocation = isRollInvocation(message) ? resolveInvocation(encounter, message.trim(), normalizedBindings) : undefined;
    const references = snapshotReferences(encounter, message.trim(), normalizedBindings);
    let formulas = invocation ? [invocation.rollable.checkFormula || invocation.rollable.effectFormula] : messageFormulas(message.trim());
    formulas.forEach(parseDiceFormula);
    const messageId = crypto.randomUUID();
    function publish(rolls: DiceResult[]) {
      if (!isPersistenceWritable() || store.getState().encounterLog.encounterSession !== session || store.getState().encounter.present.id !== encounter.id) return false;
      if (invocation) rolls.forEach((r, index) => {
        r.role = invocation.rollable.checkFormula ? "check" : "effect";
        if (invocation.checkRollMode === "perTarget") r.targetId = invocation.targets[index].id;
      });
      const entry = { id: messageId, timestamp: Date.now(), message: message.trim(), sender: { id: LOCAL_CHAT_SENDER_ID, name: "Game Master", color: chatNameColor },
        ...(references.length ? { references } : {}), ...(rolls.length ? { rolls } : {}), ...(invocation ? { invocation } : {}) };
      if (invocation?.phase === "pending") requestRollResolution(entry.id);
      store.dispatch(sendChatMessage(entry));
      return true;
    }
    // Plain chat retains its existing synchronous send/clear behavior.
    if (!formulas.length) return publish([]);
    const controller = new AbortController(); active.current = controller; setBusy(true);
    async function roll() {
      if (invocation) {
        const ask = invocation.rollable.checkFormula && invocation.targets.length > 1 && invocation.rollable.checkRollMode === "ask";
        const choice = ask ? await choose(controller.signal) : undefined;
        if (choice === null || controller.signal.aborted || !isPersistenceWritable() || store.getState().encounterLog.encounterSession !== session) return false;
        const setup = checkRollSetup(invocation, choice);
        invocation.checkRollMode = setup.mode; formulas = setup.formulas;
        playRollableAudio(encounter, invocation.rollable.audioGroupId, messageId);
      }
      const rolls = await rollWithPresentation(formulas, controller.signal, rollFormulas);
      return !controller.signal.aborted && publish(rolls);
    }
    return roll().finally(() => {
      if (active.current === controller) { active.current = null; setBusy(false); }
    });
  }
  return { send, busy, checkModeDialog };
}
