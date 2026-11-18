import { LogRollAgainButton } from "@ui/dice/LogRollAgainButton";
import { ChatMessageText } from "@ui/dice/ChatMessageText";
import { DiceMessageResults } from "@ui/dice/DiceMessageResults";
import { Wrench } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { EncounterLogCategory } from "@core/logging/types";
import { toggleSystemLogs } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";

import { LogDeleteButton } from "./LogDeleteButton";
import { useLogDeletionActions } from "./useLogDeletionActions";
import { ChatComposer } from "./ChatComposer";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";

const CATEGORY_LABELS: Record<EncounterLogCategory, string> = {
  actor: "Actor",
  annotation: "Annotation",
  background: "Background",
  edge: "Edge",
  encounter: "Encounter",
  engagement: "Engagement",
  initiative: "Initiative",
  validation: "Validation",
  zone: "Zone"
};

const BOTTOM_SCROLL_TOLERANCE_PX = 1;

type LogScrollSnapshot = {
  entryCount: number;
  isAtBottom: boolean;
  isOverflowing: boolean;
};

/** Captures the scroll state with a small tolerance for sub-pixel layout rounding. */
function getLogScrollSnapshot(
  entryCount: number,
  list: HTMLOListElement
): LogScrollSnapshot {
  const maximumScrollTop = list.scrollHeight - list.clientHeight;

  return {
    entryCount,
    isAtBottom:
      list.scrollTop >= maximumScrollTop - BOTTOM_SCROLL_TOLERANCE_PX,
    isOverflowing: maximumScrollTop > BOTTOM_SCROLL_TOLERANCE_PX
  };
}

/** Provides the Log-specific action displayed before its dock reorder control. */
export function LogPanelHeaderActions() {
  const dispatch = useDispatch();
  const { clearAll, writable } = useLogDeletionActions();
  const showSystemLogs = useSelector((state: RootState) => state.encounterLog.showSystemLogs);

  return (
    <>
    <TouchTooltip label="Show system logs"><button type="button" aria-label="Show system logs" title="Show system logs" aria-pressed={showSystemLogs}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${showSystemLogs
        ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink hover:ring-2 hover:ring-canvas-ink/40"
        : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"}`}
      onClick={() => dispatch(toggleSystemLogs())}><Wrench aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>
    <LogDeleteButton label="Clear encounter log" disabled={!writable} onClick={clearAll} />
    </>
  );
}

/** Combines durable chat and optional session audit entries chronologically. */
export function LogPanel() {
  const [rollAgainError, setRollAgainError] = useState<{ session: number; message: string } | null>(null);
  const { deleteMessage, writable } = useLogDeletionActions();
  const systemEntries = useSelector((state: RootState) => state.encounterLog.entries);
  const showSystemLogs = useSelector((state: RootState) => state.encounterLog.showSystemLogs);
  const messages = useSelector((state: RootState) => state.encounter.present.chatMessages);
  const { chatMatchMessageColor } = useInterfacePreferences();
  const entries = [
    ...messages.allIds.map(id => ({ ...messages.byId[id], category: "chat" as const, kind: "chat" as const })),
    ...(showSystemLogs ? systemEntries : [])
  ].sort((a, b) => a.timestamp - b.timestamp);
  const encounterSession = useSelector((state: RootState) => state.encounterLog.encounterSession);
  const listRef = useRef<HTMLOListElement>(null);
  const scrollSnapshotRef = useRef<LogScrollSnapshot>({
    entryCount: 0,
    isAtBottom: true,
    isOverflowing: false
  });

  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      scrollSnapshotRef.current = {
        entryCount: entries.length,
        isAtBottom: true,
        isOverflowing: false
      };
      return;
    }

    const previousSnapshot = scrollSnapshotRef.current;
    const hasNewEntry = entries.length > previousSnapshot.entryCount;

    if (
      hasNewEntry &&
      (!previousSnapshot.isOverflowing || previousSnapshot.isAtBottom)
    ) {
      list.scrollTop = list.scrollHeight;
    }

    scrollSnapshotRef.current = getLogScrollSnapshot(entries.length, list);
  });

  const handleListScroll = () => {
    const list = listRef.current;

    if (list) {
      scrollSnapshotRef.current = getLogScrollSnapshot(entries.length, list);
    }
  };

  return (
    <div className="min-w-0">
    {entries.length === 0 ? <p className="text-sm text-canvas-muted">No messages yet.</p> : null}
    <ol
      aria-label="Encounter log"
      className="max-h-80 space-y-2 overflow-y-auto pr-1"
      onScroll={handleListScroll}
      ref={listRef}
    >
      {entries.map((entry) => (
        <li
          className="group/message rounded-xl border border-canvas-line bg-canvas-surface px-3 pt-1 pb-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
          tabIndex={entry.kind === "chat" ? 0 : undefined}
          key={`${entry.kind}:${entry.id}`}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
            <span style={"sender" in entry ? { color: entry.sender.color ?? undefined } : undefined}>{"sender" in entry ? entry.sender.name : CATEGORY_LABELS[entry.category]}</span>
            <div className="flex shrink-0 items-center gap-2">
            {entry.kind === "validation-block" ? (
              <span className="text-red-700 dark:text-red-500">Blocked</span>
            ) : null}
            {entry.kind === "chat" ? (
              <div className="pointer-events-none flex items-center gap-1 opacity-0 group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100">
                {entry.rolls?.length ? <LogRollAgainButton message={entry} disabled={!writable} onError={message => setRollAgainError({ session: encounterSession, message })} /> : null}
                <LogDeleteButton plain label="Delete chat message" disabled={!writable}
                  onClick={() => deleteMessage(entry.id)} />
              </div>
            ) : null}
            </div>
          </div>
          <p className="whitespace-pre-wrap break-words text-canvas-ink" style={"sender" in entry && chatMatchMessageColor ? { color: entry.sender.color ?? undefined } : undefined}>{entry.kind === "chat" ? <ChatMessageText message={entry.message} references={entry.references} /> : entry.message}</p>
          {entry.kind === "chat" ? <DiceMessageResults message={entry} /> : null}
        </li>
      ))}
    </ol>
    {rollAgainError?.session === encounterSession && rollAgainError.message ? <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{rollAgainError.message}</p> : null}
    <ChatComposer key={encounterSession} />
    </div>
  );
}
