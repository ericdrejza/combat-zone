import { useEffect, useState } from 'react';

/** Cross-window entry requires an explicit browser grant, unlike a direct click in the player window. */
export function useAutomaticFullscreenPermission(ownerDocument: Document | null, enabled: boolean) {
  const [permission, setPermission] = useState<{ document: Document; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!enabled || !ownerDocument) return;
    const permissions = ownerDocument.defaultView?.navigator.permissions;
    if (!permissions?.query) return;
    let disposed = false;
    let status: PermissionStatus | undefined;
    const sync = () => {
      if (!disposed) setPermission({ document: ownerDocument, allowed: status?.state === 'granted' });
    };
    // The descriptor is Chromium-specific and is not included in TypeScript's PermissionName yet.
    const descriptor = { name: 'fullscreen' as PermissionName, allowWithoutGesture: true };
    void (async () => {
      try {
        const result = await permissions.query(descriptor);
        if (disposed) return;
        status = result;
        sync();
        status.addEventListener('change', sync);
      } catch { sync(); }
    })();
    return () => { disposed = true; status?.removeEventListener('change', sync); };
  }, [ownerDocument, enabled]);
  return permission?.document === ownerDocument && permission.allowed;
}
