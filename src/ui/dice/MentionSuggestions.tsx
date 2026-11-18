import { UsersRound } from "lucide-react";
import { TOOL_ICONS } from "@ui/toolbar/toolbarItems";
import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { chatSuggestions, type ChatSuggestion } from "@core/dice/chatSuggestions";
import { referenceQuote } from "@core/dice/referenceSyntax";
import { suggestionSuffix } from "@core/dice/suggestionMatching";

const EMPTY_IDS: string[] = [];
const EMPTY_BINDINGS: Record<string, string> = {};
export const TARGET_PREVIEW_EVENT = "combat-zone:dice-target-preview";
export function previewDiceTarget(ids: string[] | string | null) { window.dispatchEvent(new CustomEvent(TARGET_PREVIEW_EVENT, { detail: typeof ids === "string" ? [ids] : ids ?? [] })); }
export type SuggestionKeys = { handleKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean; resumeEditing: (restore?: boolean) => void };
function suggestionFragment(choice: ChatSuggestion, draft: string, caret: number) {
  const raw = draft.slice(choice.start, caret);
  return choice.kind === "command" ? raw : raw.replace(/^@/, "").replace(/^["']/, "");
}
function completionSuffix(choice: ChatSuggestion, draft: string, caret: number) {
  return suggestionSuffix(choice.name, suggestionFragment(choice, draft, caret),
    choice.kind !== "command" && !referenceQuote(draft.slice(choice.start, caret)));
}
/** Pointer and keyboard selection share completion, scrolling, and canvas target previews. */
export const MentionSuggestions = forwardRef<SuggestionKeys, {
  draft: string; caret: number; sourceId?: string; input: HTMLTextAreaElement | null;
  bindings?: Record<string, string>;
  disabled?: boolean;
  children: (suffix: string) => ReactNode;
  onChoose: (text: string, binding: ChatSuggestion["binding"], caret: number) => void;
}>(function MentionSuggestions({ draft, caret, onChoose, children, disabled, sourceId, bindings = EMPTY_BINDINGS, input }, ref) {
  const state = useSelector((s: RootState) => s.encounter.present);
  const selectedActorIds = useSelector((s: RootState) => s.interaction.selection.selectedEntityType === "actor" ? s.interaction.selection.selectedIds : EMPTY_IDS);
  const choices = useMemo(() => disabled ? [] : chatSuggestions(state, draft, caret, sourceId, selectedActorIds, bindings), [disabled, state, draft, caret, sourceId, selectedActorIds, bindings]);
  const signature = JSON.stringify(choices);
  const [navigation, setNavigation] = useState({ signature: "", index: -1, dismissed: false, keyboard: false });
  const previousMatch = useRef<{ key: string; start: number; prefix: string } | null>(null);
  const retainedIndex = choices.findIndex(choice => choice.key === previousMatch.current?.key && choice.start === previousMatch.current.start
    && draft.slice(0, choice.start) === previousMatch.current.prefix
    && completionSuffix(choice, draft, caret) !== null);
  const current = navigation.signature === signature ? navigation : { signature, index: retainedIndex >= 0 ? retainedIndex : choices.length ? 0 : -1, dismissed: false, keyboard: false };
  const visible = !current.dismissed && choices.length > 0;
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  const selection = useRef<{ start: number; end: number; direction: "forward" | "backward" | "none" } | null>(null);
  const active = visible ? choices[current.index] : undefined;
  const keyboardActive = !!active && current.keyboard;
  const suffix = active && caret === draft.length && caret === active.end
    ? completionSuffix(active, draft, caret) ?? "" : "";
  useLayoutEffect(() => {
    previousMatch.current = active ? { key: active.key, start: active.start, prefix: draft.slice(0, active.start) } : null;
  });
  // Retain native textarea focus for typing and IME while active-descendant focus owns navigation.
  useLayoutEffect(() => {
    if (!input || !keyboardActive) return;
    const previous = input.style.caretColor;
    input.style.caretColor = "transparent";
    return () => { input.style.caretColor = previous; };
  }, [input, keyboardActive]);
  const preview = active?.actorIds.join("\0") ?? "";
  useEffect(() => { previewDiceTarget(preview ? preview.split("\0") : []); return () => previewDiceTarget(null); }, [preview]);
  useEffect(() => {
    if (!input || !visible) return;
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-autocomplete", suffix ? "both" : "list");
    if (active) input.setAttribute("aria-activedescendant", `${listId}-${current.index}`);
    else input.removeAttribute("aria-activedescendant");
    return () => { for (const attr of ["aria-controls", "aria-expanded", "aria-autocomplete", "aria-activedescendant"]) input.removeAttribute(attr); };
  }, [input, visible, active?.key, current.index, listId, suffix]);
  useEffect(() => {
    const menu = list.current;
    const option = menu?.querySelector<HTMLElement>(`[data-index="${current.index}"]`);
    if (!active || !menu || !option) return;
    // Reveal the option only inside its menu; scrollIntoView can move the whole sidebar past its footer.
    const bounds = menu.getBoundingClientRect(), row = option.getBoundingClientRect();
    if (row.top < bounds.top) menu.scrollTop += row.top - bounds.top;
    else if (row.bottom > bounds.bottom) menu.scrollTop += row.bottom - bounds.bottom;
  }, [current.index, active?.key]);
  function focus(index: number, keyboard = false) {
    if (keyboard && !keyboardActive && input) selection.current = { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection };
    setNavigation({ signature, index, dismissed: false, keyboard });
    if (keyboard) input?.focus({ preventScroll: true });
  }
  function resumeEditing(restore = true, retainMatch = false) {
    if (restore && keyboardActive && input && selection.current) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(selection.current.start, selection.current.end, selection.current.direction);
    }
    setNavigation({ signature, index: retainMatch ? current.index : -1, dismissed: false, keyboard: false });
  }
  function choose(choice: ChatSuggestion) {
    const text = draft.slice(0, choice.start) + choice.text + draft.slice(choice.end);
    onChoose(text, choice.binding, choice.start + choice.text.length);
    const nextBindings = choice.binding ? { ...bindings, [choice.binding.key]: choice.binding.id } : bindings;
    setNavigation({ signature: JSON.stringify(chatSuggestions(state, text, choice.start + choice.text.length, sourceId, selectedActorIds, nextBindings)), index: -1, dismissed: true, keyboard: false });
    previewDiceTarget(null);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!visible) return false;
    if (event.nativeEvent.isComposing || event.keyCode === 229) { resumeEditing(false); return false; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || keyboardActive && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const index = (event.key === "ArrowDown" || event.key === "ArrowRight") ? (current.index + 1) % choices.length : (current.index <= 0 ? choices.length : current.index) - 1;
      focus(index, true);
      return true;
    }
    const typingQuotedName = active && referenceQuote(draft.slice(active.start, caret)) && choices.some(choice => /\s/.test(choice.name));
    if ((event.key === "Tab" || event.key === "Enter" || event.key === " " && !typingQuotedName) && current.index >= 0) {
      event.preventDefault(); choose(choices[current.index]); return true;
    }
    if (event.key === "Escape") { event.preventDefault(); resumeEditing(); setNavigation({ signature, index: -1, dismissed: true, keyboard: false }); return true; }
    if (keyboardActive) resumeEditing(true, true);
    return false;
  }
  useImperativeHandle(ref, () => ({ handleKeyDown, resumeEditing }));
  // Render the preview with the editor so a commit can never pair a new draft with an old suffix.
  return <>{children(suffix)}{visible ? <div onKeyDown={handleKeyDown} ref={list} id={listId} role="listbox" aria-label="Chat suggestions" className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto">{choices.map((c, i) => {
    const Icon = c.kind === "actor" ? TOOL_ICONS.actor : c.kind === "zone" ? TOOL_ICONS.zone : c.kind === "faction" ? UsersRound : null;
    const kindLabel = c.kind === "actor" ? "Actor" : c.kind === "zone" ? "Zone" : c.kind === "faction" ? "Faction" : null;
    return <button key={c.key} id={`${listId}-${i}`} data-index={i} type="button" role="option" aria-label={kindLabel ? `${c.name} (${kindLabel}${c.detail ? `, ${c.detail}` : ""})` : c.name} aria-selected={current.index === i}
      className={`inline-flex max-w-full items-center gap-1.5 break-words rounded border p-2 text-sm hover:bg-canvas focus-visible:ring-2 focus-visible:ring-canvas-ink ${current.index === i ? "border-canvas-ink bg-canvas" : "border-canvas-line"}`}
      onMouseEnter={() => focus(i)} onMouseLeave={() => { if (!keyboardActive) focus(-1); }} onFocus={() => focus(i, true)} onBlur={event => { if (event.relatedTarget !== input) focus(-1); }} onMouseDown={e => e.preventDefault()} onClick={() => choose(c)}>
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-canvas-muted" /> : null}<span className="min-w-0 break-words">{c.name}</span>{c.detail ? <span className="text-xs text-canvas-muted">({c.detail})</span> : null}
    </button>;
  })}</div> : null}</>;
});
