import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@ui/theme/ThemeProvider';

/** Keeps browser window lifetime, styles, and theme shared across panel popouts. */
export function usePanelPopout(panel: string, title: string, width = 420) {
  const [popup, setPopup] = useState<Window | null>(null);
  const popupRef = useRef<Window | null>(null);
  const { theme } = useTheme();
  const rootId = `${panel}-root`;

  const close = useCallback(() => {
    const previous = popupRef.current;
    popupRef.current = null;
    setPopup(null);
    if (previous && !previous.closed) previous.close();
  }, []);

  const open = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return; }
    const next = window.open('', `combat-zone-${panel}`, `popup,width=${width},height=720,toolbar=no,location=no,menubar=no`);
    if (!next) { window.alert(`The ${title} popup was blocked. Allow popups for this site and try again.`); return; }
    next.document.title = `Combat Zone ${title}`;
    const root = next.document.createElement('div');
    root.id = rootId;
    next.document.body.replaceChildren(root);
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => next.document.head.append(node.cloneNode(true)));
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', panel);
      next.history.replaceState(null, '', url.href);
    } catch { /* Browser owns the popup's location chrome. */ }
    next.addEventListener('beforeunload', () => {
      if (popupRef.current === next) { popupRef.current = null; setPopup(null); }
    }, { once: true });
    popupRef.current = next;
    setPopup(next);
  }, [panel, rootId, title, width]);

  const toggle = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) close();
    else open();
  }, [close, open]);

  useEffect(() => {
    if (!popup || popup.closed) return;
    popup.document.documentElement.classList.toggle('dark', theme === 'dark');
    popup.document.documentElement.dataset.theme = theme;
  }, [popup, theme]);

  useEffect(() => {
    window.addEventListener('beforeunload', close);
    return () => { window.removeEventListener('beforeunload', close); popupRef.current?.close(); };
  }, [close]);

  return { popup, root: popup?.document.getElementById(rootId), open, close, toggle };
}
