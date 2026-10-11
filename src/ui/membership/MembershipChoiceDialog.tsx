import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { gridSettingsButton } from '@ui/toolbar/grid/GridSettingsFields';
import { subscribeMembershipChoices, type MembershipRequest } from './membershipChoices';

export function MembershipChoiceDialog() {
  const [request, setRequest] = useState<MembershipRequest | null>(null);
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const { readOnly } = usePersistence();
  useEffect(() => {
    let pending: MembershipRequest | undefined;
    const unsubscribe = subscribeMembershipChoices(next => { pending?.resolve(null); pending = next; setRequest(next); });
    return () => { pending?.resolve(null); unsubscribe(); };
  }, []);
  useEffect(() => { if (request && (readOnly || request.snapshot !== encounter)) { request.resolve(null); setRequest(null); } }, [request, encounter, readOnly]);
  useEffect(() => {
    if (!request) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); request.resolve(null); setRequest(null); } };
    window.addEventListener('keydown', escape, true); return () => window.removeEventListener('keydown', escape, true);
  }, [request]);
  if (!request) return null;
  function choose(value: string | null) { request!.resolve(value); setRequest(null); }
  return <div role="dialog" aria-modal="true" aria-label="Choose actor Zone" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3" onClick={() => choose(null)}>
    <section className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-canvas-line bg-canvas-panel p-5" onClick={event => event.stopPropagation()}>
      <h3 className="font-display text-lg font-semibold">Choose a Zone for {request.actorName}</h3>
      <div className="flex flex-wrap gap-2">{request.candidates.map(id => <button autoFocus={id === request.candidates[0]} key={id} type="button" className={gridSettingsButton} onClick={() => choose(id)}>{encounter.zones.byId[id]?.name || 'Unnamed Zone'}</button>)}</div>
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className={gridSettingsButton} onClick={() => choose(null)}>Cancel</button>{request.hasFallback ? <button type="button" className={gridSettingsButton} onClick={() => choose('fallback')}>Use next decider</button> : null}</div>
    </section>
  </div>;
}
