/** Global shortcuts yield to text editing, modal workflows, and prior handlers. */
export function ignoreShortcut(event: Event, allowPlayerPreview = false, allowCanvasFocus = false): boolean {
  const target = event.target;
  const element = target && 'ownerDocument' in target ? target as HTMLElement : null;
  const owner = element?.ownerDocument ?? document;
  return event.defaultPrevented || (!allowCanvasFocus && document.documentElement.dataset.canvasFocus === 'true') || (!allowPlayerPreview && Boolean(document.querySelector('[data-player-preview]'))) || Boolean(document.querySelector('[aria-modal="true"]') || owner.querySelector('[aria-modal="true"]')) ||
    (element?.nodeType === 1 && (element.matches('input, textarea, select') || element.isContentEditable ||
      Boolean(element.closest('[contenteditable]:not([contenteditable="false"])'))));
}
