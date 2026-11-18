import { useCanvasReferencePick } from "@ui/dice/useCanvasReferencePick";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";
import { Send } from "lucide-react";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSendDiceMessage } from "@ui/dice/useSendDiceMessage";
import { MentionSuggestions, type SuggestionKeys } from "@ui/dice/MentionSuggestions";
import { AmbiguousMentionError } from "@core/dice/resolveInvocation";
import { useMobileControls } from "@hooks/useMobileControls";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { useMessageHistory } from "@ui/dice/useMessageHistory";

/** Measure after resetting height so deleting text can shrink the composer too. */
function fitDraftHeight(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  const borderHeight = input.offsetHeight - input.clientHeight;
  input.style.height = `${input.scrollHeight + borderHeight}px`;
}

/** Chat is saved with the encounter independently of its undo/redo timeline. */
export function ChatComposer() {
  const [draft, setDraft] = useState("");
  const [historyRecall, setHistoryRecall] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRef = useRef<SuggestionKeys>(null);
  const [caret, setCaret] = useState(0);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const syncCaret = () => { if (input.ownerDocument.activeElement === input) setCaret(input.selectionStart); };
    input.addEventListener("selectionchange", syncCaret);
    input.ownerDocument.addEventListener("selectionchange", syncCaret);
    return () => { input.removeEventListener("selectionchange", syncCaret); input.ownerDocument.removeEventListener("selectionchange", syncCaret); };
  }, []);
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
  const { send: submit, busy, checkModeDialog } = useSendDiceMessage();
  const [error, setError] = useState("");
  const [ambiguity, setAmbiguity] = useState<AmbiguousMentionError | null>(null);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const mobile = useMobileControls(false);
  const { readOnly } = useContext(PersistenceContext);
  const writable = !readOnly && isPersistenceWritable();
  const messageHistory = useMessageHistory({ inputRef, bindings, enabled: writable && !busy,
    onRestore: restored => { setDraft(restored.text); setBindings(restored.bindings); setCaret(restored.start); setHistoryRecall(true); setAmbiguity(null); setError(""); } });
  function completeReference(text: string, nextBindings: Record<string, string>, position: number) {
    setDraft(text); setCaret(position); setAmbiguity(null); setError("");
    setBindings(prev => ({ ...prev, ...nextBindings }));
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(position, position); });
  }
  useCanvasReferencePick({ inputRef, draft, caret, enabled: writable && !busy,
    onPick: pick => completeReference(pick.text, pick.bindings, pick.caret) });
  function send() {
    if (!draft.trim() || !writable || busy) return;
    setError(""); setAmbiguity(null);
    const clear = (sent: boolean) => { if (sent) { setDraft(""); setBindings({}); setHistoryRecall(false); messageHistory.reset(); } };
    const fail = (error: unknown) => { if (error instanceof AmbiguousMentionError) setAmbiguity(error); else setError(error instanceof Error ? error.message : "Could not send roll."); };
    try { const sent = submit(draft, bindings); if (typeof sent === "boolean") clear(sent); else void sent.then(clear).catch(fail); }
    catch (error) { fail(error); }
  }
  return <div className="mt-3 min-w-0">
    {checkModeDialog}
    <MentionSuggestions ref={suggestionRef} input={inputRef.current} caret={caret} sourceId={bindings.source} bindings={bindings} draft={draft} disabled={busy || historyRecall} onChoose={(text, binding, position) => {
      completeReference(text, binding ? { [binding.key]: binding.id } : {}, position);
    }}>{completion => <>
    <div className="relative">
    <textarea aria-label="Chat message" placeholder="Message" ref={inputRef} rows={1} value={draft} disabled={!writable || busy}
      className="scrollbar-hidden block w-full resize-none overflow-hidden rounded-xl border border-canvas-line bg-canvas-surface p-3 pr-12 text-sm text-canvas-ink hover:border-canvas-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-canvas-line"
      onBlur={() => suggestionRef.current?.resumeEditing(false)}
      onPointerDown={() => suggestionRef.current?.resumeEditing(false)}
      onSelect={event => setCaret(event.currentTarget.selectionStart)}
      onChange={event => { setCaret(event.target.selectionStart); setDraft(event.target.value); setHistoryRecall(false); setAmbiguity(null); setError(""); }}
      onKeyDown={event => {
        if (suggestionRef.current?.handleKeyDown(event)) return;
        if (messageHistory.handleKeyDown(event)) return;
        if (event.key === "Enter" && !event.shiftKey && !mobile && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault(); send();
        }
      }} />
    {completion ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent p-3 pr-12 text-sm"><span className="invisible">{draft.slice(0, caret)}</span><span className="text-canvas-muted">{completion}</span></div> : null}
    <div className="absolute bottom-1.5 right-2"><TouchTooltip label="Send message">
      <button type="button" aria-label="Send message" title="Send message" disabled={!writable || busy || !draft.trim()}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-ink enabled:hover:bg-canvas focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40"
        onClick={send}><Send aria-hidden="true" className="h-4 w-4" /></button>
    </TouchTooltip></div>
    </div>
    </>}</MentionSuggestions>
    {ambiguity ? <div role="group" aria-label="Resolve ambiguous mention"><p>{ambiguity.message}</p>{ambiguity.choices.map((choice, i) => <button key={choice.id} type="button" className="m-1 rounded border border-canvas-line p-2 hover:bg-canvas focus-visible:ring-2 focus-visible:ring-canvas-ink" onClick={() => { setBindings({ ...bindings, [ambiguity.key]: choice.id }); setAmbiguity(null); }}>{choice.name} ({i + 1}){choice.detail ? <span className="ml-1 text-xs text-canvas-muted">{choice.detail}</span> : null}</button>)}</div> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
  </div>;
}
