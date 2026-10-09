/** Global shortcuts yield to text editing, modal workflows, and prior handlers. */
export function ignoreShortcut(event: KeyboardEvent): boolean {
  const target = event.target;
  return event.defaultPrevented || Boolean(document.querySelector('[aria-modal="true"]')) ||
    (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable));
}
