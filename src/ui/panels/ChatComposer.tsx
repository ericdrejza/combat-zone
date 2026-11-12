import { PersistenceContext } from "@ui/persistence/PersistenceContext";
import { Send } from "lucide-react";
import { useContext, useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useMobileControls } from "@hooks/useMobileControls";
import { sendChatMessage } from "@store/encounterSlice";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

/** Measure after resetting height so deleting text can shrink the composer too. */
function fitDraftHeight(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  const borderHeight = input.offsetHeight - input.clientHeight;
  input.style.height = `${input.scrollHeight + borderHeight}px`;
}

/** Chat is saved with the encounter independently of its undo/redo timeline. */
export function ChatComposer() {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (inputRef.current) fitDraftHeight(inputRef.current);
  }, [draft]);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || typeof ResizeObserver === "undefined") return;
    let width = input.getBoundingClientRect().width;
    // Wrapping changes when a dock or viewport resizes, even without new input.
    const observer = new ResizeObserver(() => {
      const nextWidth = input.getBoundingClientRect().width;
      if (nextWidth !== width) {
        width = nextWidth;
        fitDraftHeight(input);
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, []);
  const dispatch = useDispatch();
  const mobile = useMobileControls(false);
  const { chatNameColor } = useInterfacePreferences();
  const { readOnly } = useContext(PersistenceContext);
  const writable = !readOnly && isPersistenceWritable();
  function send() {
    if (!draft.trim() || !writable || !isPersistenceWritable()) return;
    const entry = { id: crypto.randomUUID(), timestamp: Date.now(), message: draft.trim(),
      sender: { id: "game-master", name: "Game Master", color: chatNameColor } };
    dispatch(sendChatMessage(entry));
    setDraft("");
  }
  return <div className="relative mt-3 min-w-0">
    <textarea aria-label="Chat message" placeholder="Message" ref={inputRef} rows={1} value={draft} disabled={!writable}
      className="scrollbar-hidden block w-full resize-none overflow-hidden rounded-xl border border-canvas-line bg-canvas-surface p-3 pr-12 text-sm text-canvas-ink hover:border-canvas-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-canvas-line"
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => {
        if (event.key === "Enter" && !event.shiftKey && !mobile && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault(); send();
        }
      }} />
    <div className="absolute bottom-1.5 right-2"><TouchTooltip label="Send message">
      <button type="button" aria-label="Send message" title="Send message" disabled={!writable || !draft.trim()}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-ink enabled:hover:bg-canvas focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40"
        onClick={send}><Send aria-hidden="true" className="h-4 w-4" /></button>
    </TouchTooltip></div>
  </div>;
}
