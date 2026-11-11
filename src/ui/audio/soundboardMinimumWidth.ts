/** Resize events have no drag-end signal; correct only after resizing is quiet. */
export function attachSoundboardMinimumWidth(popup: Window): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastAttemptWidth: number | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (popup.closed || !(popup.innerWidth > 0) || popup.innerWidth >= 370) {
        lastAttemptWidth = undefined;
        return;
      }
      // A browser that ignores the request must not cause a correction loop.
      if (lastAttemptWidth === popup.innerWidth) return;
      lastAttemptWidth = popup.innerWidth;
      popup.resizeTo(popup.outerWidth + 370 - popup.innerWidth, popup.outerHeight);
    }, 500);
  };
  popup.addEventListener("resize", schedule);
  return () => {
    clearTimeout(timer);
    popup.removeEventListener("resize", schedule);
  };
}
