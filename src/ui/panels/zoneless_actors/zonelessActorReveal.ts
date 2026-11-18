import { useContext, useSyncExternalStore } from "react";
import { ReactReduxContext } from "react-redux";
import type { RootState } from "@store/store";

type RevealRequest = { actorId: string; session: number };
let request: RevealRequest | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => request;
const noSubscription = () => () => {};

/** A session-only navigation request also reaches panels mounted by opening a drawer or tab. */
export function revealZonelessActor(actorId: string, session: number) {
  request = { actorId, session };
  listeners.forEach(listener => listener());
}

export function useZonelessActorReveal() {
  const context = useContext(ReactReduxContext);
  const session = useSyncExternalStore(context?.store.subscribe ?? noSubscription,
    () => (context?.store.getState() as RootState | undefined)?.encounterLog.encounterSession, () => undefined);
  const current = useSyncExternalStore(subscribe, snapshot, () => null);
  return current?.session === session ? current : null;
}

/** Scroll only panel containers; native scrollIntoView can move the sidebar past its footer. */
export function revealZonelessToken(token: HTMLElement) {
  for (let parent = token.parentElement; parent && parent !== token.ownerDocument.body; parent = parent.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY) || !parent.clientHeight) continue;
    const row = token.getBoundingClientRect(), viewport = parent.getBoundingClientRect();
    const top = viewport.top + parent.clientTop;
    const bottom = top + parent.clientHeight;
    if (row.top < top) parent.scrollTop += row.top - top;
    else if (row.bottom > bottom) parent.scrollTop += row.bottom - bottom;
  }
}
