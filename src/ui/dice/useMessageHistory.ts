import { useLayoutEffect, useMemo, useRef, type KeyboardEvent, type RefObject } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { LOCAL_CHAT_SENDER_ID } from "@core/chat/types";
import { messageBindings } from "@core/dice/messageBindings";
import { isFirstDraftLine } from "./isFirstDraftLine";

export type MessageDraft = {
  text: string; bindings: Record<string, string>;
  start: number; end: number; direction: "forward" | "backward" | "none";
};
/** Recalled edits are session-only; sent messages and encounter history remain untouched. */
export function useMessageHistory({ inputRef, bindings, enabled, onRestore }: {
  inputRef: RefObject<HTMLTextAreaElement>; bindings: Record<string, string>; enabled: boolean;
  onRestore: (draft: MessageDraft) => void;
}) {
  const messages = useSelector((state: RootState) => state.encounter.present.chatMessages);
  const own = useMemo(() => {
    const seen = new Set<string>();
    // Keep the most recent occurrence, including its saved reference identities.
    return messages.allIds.slice().reverse().map(id => messages.byId[id]).filter(message => {
      if (message.sender.id !== LOCAL_CHAT_SENDER_ID || /[\r\n]/.test(message.message) || seen.has(message.message)) return false;
      seen.add(message.message); return true;
    }).reverse();
  }, [messages]);
  const currentId = useRef<string | null>(null);
  const original = useRef<MessageDraft | null>(null);
  const edits = useRef(new Map<string, MessageDraft>());
  const pending = useRef<MessageDraft | null>(null);
  useLayoutEffect(() => {
    const input = inputRef.current, draft = pending.current;
    if (!input || !draft || input.value !== draft.text) return;
    pending.current = null;
    input.setSelectionRange(draft.start, draft.end, draft.direction);
  });
  function reset() { currentId.current = null; original.current = null; edits.current.clear(); pending.current = null; }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!enabled || !["ArrowUp", "ArrowDown"].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return false;
    const input = event.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return false;
    const browsing = currentId.current !== null;
    if (!browsing && (event.key !== "ArrowUp" || !own.length || !isFirstDraftLine(input))) return false;
    event.preventDefault();
    const snapshot: MessageDraft = { text: input.value, bindings: { ...bindings }, start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection };
    if (browsing) edits.current.set(currentId.current!, snapshot);
    else original.current = snapshot;
    const index = browsing ? own.findIndex(message => message.id === currentId.current) : own.length;
    const nextIndex = Math.max(0, Math.min(own.length, index + (event.key === "ArrowUp" ? -1 : 1)));
    if (browsing && nextIndex === index) return true;
    const message = own[nextIndex];
    const draft = message ? edits.current.get(message.id) ?? { text: message.message, bindings: messageBindings(message), start: message.message.length, end: message.message.length, direction: "none" as const } : original.current;
    currentId.current = message?.id ?? null;
    if (draft) {
      pending.current = draft;
      onRestore(draft);
      // Identical text can skip a React update; restore its selection immediately.
      if (input.value === draft.text) { pending.current = null; input.setSelectionRange(draft.start, draft.end, draft.direction); }
    }
    return true;
  }
  return { handleKeyDown, reset };
}
