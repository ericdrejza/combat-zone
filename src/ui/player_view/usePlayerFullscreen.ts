import { useCallback, useEffect, useRef, useState } from 'react';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import { useAutomaticFullscreenPermission } from './useAutomaticFullscreenPermission';

/** One session shares fullscreen state and a keyboard handoff between GM and player controls. */
export function usePlayerFullscreen(ownerDocument: Document | null) {
  const [fullscreen, setFullscreen] = useState(Boolean(ownerDocument?.fullscreenElement));
  const [pendingDocument, setPendingDocument] = useState<Document | null>(null);
  const [error, setError] = useState(false);
  const pending = useRef<Document | null>(null);
  const currentDocument = useRef(ownerDocument);
  currentDocument.current = ownerDocument;
  const supported = ownerDocument?.fullscreenEnabled === true &&
    typeof ownerDocument.documentElement.requestFullscreen === 'function' &&
    typeof ownerDocument.exitFullscreen === 'function';
  const automaticAllowed = useAutomaticFullscreenPermission(ownerDocument, supported);
  const cancel = useCallback(() => { pending.current = null; setPendingDocument(null); }, []);

  const changeFullscreen = async (enter: boolean) => {
    if (!ownerDocument || !supported) return false;
    cancel(); setError(false);
    try {
      if (enter) await ownerDocument.documentElement.requestFullscreen();
      else await ownerDocument.exitFullscreen();
      return true;
    } catch {
      if (currentDocument.current === ownerDocument) setError(true);
      return false;
    }
  };
  const changeRef = useRef(changeFullscreen);
  changeRef.current = changeFullscreen;

  useEffect(() => {
    cancel(); setError(false);
    const sync = () => { setFullscreen(Boolean(ownerDocument?.fullscreenElement)); cancel(); setError(false); };
    sync();
    const popup = ownerDocument?.defaultView;
    if (!ownerDocument || !popup) return;
    const key = (event: KeyboardEvent) => {
      if (pending.current !== ownerDocument || event.repeat || event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); return; }
      if ((event.key !== 'Enter' && event.key !== ' ') || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || ignoreShortcut(event, true, true)) return;
      // A real keydown activates the player window; consume it before button activation or scrolling.
      event.preventDefault(); event.stopImmediatePropagation();
      void changeRef.current(true);
    };
    const hidden = () => { if (ownerDocument.hidden) cancel(); };
    ownerDocument.addEventListener('fullscreenchange', sync);
    ownerDocument.addEventListener('visibilitychange', hidden);
    popup.addEventListener('keydown', key, true);
    popup.addEventListener('blur', cancel);
    popup.addEventListener('beforeunload', cancel);
    return () => {
      pending.current = null;
      ownerDocument.removeEventListener('fullscreenchange', sync);
      ownerDocument.removeEventListener('visibilitychange', hidden);
      popup.removeEventListener('keydown', key, true);
      popup.removeEventListener('blur', cancel);
      popup.removeEventListener('beforeunload', cancel);
    };
  }, [ownerDocument, cancel]);

  const arm = () => {
    if (!ownerDocument || currentDocument.current !== ownerDocument) return;
    setError(false); pending.current = ownerDocument; setPendingDocument(ownerDocument);
    try { ownerDocument.defaultView?.focus(); }
    catch { cancel(); setError(true); }
  };
  const toggle = async (fromGM: boolean) => {
    if (!ownerDocument || !supported) return;
    if (ownerDocument.fullscreenElement) { await changeFullscreen(false); return; }
    // Reuse a valid recent player-window gesture when available; no confirmation is needed then.
    if (!fromGM || automaticAllowed || ownerDocument.defaultView?.navigator.userActivation?.isActive) {
      if (await changeFullscreen(true) || !fromGM) return;
    }
    arm();
  };
  return { ownerDocument, fullscreen, supported, automaticAllowed, pending: Boolean(ownerDocument && pendingDocument === ownerDocument), error, toggle };
}

export type PlayerFullscreen = ReturnType<typeof usePlayerFullscreen>;
