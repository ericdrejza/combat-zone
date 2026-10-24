import { useLayoutEffect } from "react";

const leases = new WeakMap<Document, number>();

/** Keep grab feedback across descendants and portals until the pointer is released. */
export function useGrabbingCursor(active: boolean, ownerDocument: Document = document): void {
  useLayoutEffect(() => {
    if (!active) return;
    leases.set(ownerDocument, (leases.get(ownerDocument) ?? 0) + 1);
    ownerDocument.documentElement.classList.add("actor-drag-grabbing");
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const count = (leases.get(ownerDocument) ?? 1) - 1;
      if (count === 0) {
        leases.delete(ownerDocument);
        ownerDocument.documentElement.classList.remove("actor-drag-grabbing");
      } else leases.set(ownerDocument, count);
      ownerDocument.removeEventListener("pointerup", release, true);
      ownerDocument.removeEventListener("pointercancel", release, true);
      ownerDocument.removeEventListener("mouseup", release, true);
      ownerDocument.removeEventListener("keydown", cancel, true);
      ownerDocument.defaultView?.removeEventListener("blur", release);
    };
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape") release(); };
    ownerDocument.addEventListener("pointerup", release, true);
    ownerDocument.addEventListener("pointercancel", release, true);
    ownerDocument.addEventListener("mouseup", release, true);
    ownerDocument.addEventListener("keydown", cancel, true);
    ownerDocument.defaultView?.addEventListener("blur", release);
    return release;
  }, [active, ownerDocument]);
}
