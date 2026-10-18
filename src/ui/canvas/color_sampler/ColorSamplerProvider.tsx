import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';

type Session = { key: string; kind: 'background' | 'zone'; pick: (value: string) => void };
type Sampler = {
  session: Session | null;
  error: string | null;
  toggle: (session: Session) => void;
  cancel: (key?: string) => void;
  choose: (session: Session, value: string) => void;
  fail: (session: Session) => void;
};
const Context = createContext<Sampler>({ session: null, error: null, toggle() {}, cancel() {}, choose() {}, fail() {} });

/** Sampling is session-only; existing property commands own validation/history. */
export function ColorSamplerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null), [error, setError] = useState<string | null>(null);
  const current = useRef<Session | null>(null);
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const scope = useSelector((state: RootState) => `${state.encounter.present.id}:${state.interaction.activeToolId}:${state.interaction.selection.selectedEntityType}:${state.interaction.selection.selectedIds.join(',')}`);
  const cancel = useCallback((key?: string) => {
    if (key && current.current?.key !== key) return;
    current.current = null; setSession(null);
  }, []);
  useEffect(() => { cancel(); }, [scope, encounter, cancel]);
  useEffect(() => {
    if (!session) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); cancel();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [session, cancel]);
  return <Context.Provider value={{ session, error, cancel,
    toggle: next => { setError(null); const value = current.current?.key === next.key ? null : next; current.current = value; setSession(value); },
    choose: (expected, value) => { if (current.current !== expected) return; cancel(); expected.pick(value); },
    fail: expected => { if (current.current !== expected) return; cancel(); setError('This background does not allow reading its pixels.'); }
  }}>{children}</Context.Provider>;
}

export const useColorSampler = () => useContext(Context);
