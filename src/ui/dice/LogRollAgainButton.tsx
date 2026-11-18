import { RotateCw } from "lucide-react";
import type { ChatMessage } from "@core/chat/types";
import { messageBindings } from "@core/dice/messageBindings";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { useSendDiceMessage } from "./useSendDiceMessage";

/** Replay the command through normal current-state resolution without changing the original card. */
export function LogRollAgainButton({ message, disabled, onError }: { message: ChatMessage; disabled: boolean; onError: (error: string) => void }) {
  const { send, busy, checkModeDialog } = useSendDiceMessage();
  async function rollAgain() {
    onError("");
    try { await send(message.message, messageBindings(message)); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not roll again."); }
  }
  return <>{checkModeDialog}<TouchTooltip label="Roll again"><button type="button" aria-label="Roll again" title="Roll again" disabled={disabled || busy} onClick={() => void rollAgain()}
    className="flex h-6 w-6 shrink-0 items-center justify-center bg-transparent text-canvas-muted enabled:hover:text-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40">
    <RotateCw aria-hidden="true" className="h-4 w-4" />
  </button></TouchTooltip></>;
}
