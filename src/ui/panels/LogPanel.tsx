import { Trash2 } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { EncounterLogCategory } from "@core/logging/types";
import { resetEncounterLog } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";

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

  return (
    <button
      aria-label="Clear encounter log"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas"
      onClick={() => dispatch(resetEncounterLog())}
      title="Clear encounter log"
      type="button"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

/** Presents the encounter audit stream without coupling the UI to action payloads. */
export function LogPanel() {
  const entries = useSelector(
    (state: RootState) => state.encounterLog.entries
  );
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

  if (entries.length === 0) {
    return (
      <p className="text-sm text-canvas-muted">
        Actions and blocked validation attempts will appear here.
      </p>
    );
  }

  return (
    <ol
      aria-label="Encounter log"
      className="max-h-80 space-y-2 overflow-y-auto pr-1"
      onScroll={handleListScroll}
      ref={listRef}
    >
      {entries.map((entry) => (
        <li
          className="rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm"
          key={entry.id}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
            <span>{CATEGORY_LABELS[entry.category]}</span>
            {entry.kind === "validation-block" ? (
              <span className="text-red-700">Blocked</span>
            ) : null}
          </div>
          <p className="text-canvas-ink">{entry.message}</p>
        </li>
      ))}
    </ol>
  );
}
