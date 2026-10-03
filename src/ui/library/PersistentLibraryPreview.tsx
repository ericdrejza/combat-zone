import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Relocates the preview without remounting its media player or resetting time. */
export function PersistentLibraryPreview({ children, container, className, onPointerEnter, onPointerLeave }: {
  children: ReactNode;
  container?: HTMLElement | null;
  className: string;
  onPointerEnter: () => void;
  onPointerLeave?: () => void;
}) {
  const [inlineContainer, setInlineContainer] = useState<HTMLDivElement | null>(null);
  const [host] = useState(() => document.createElement("div"));
  useLayoutEffect(() => {
    const destination = container ?? inlineContainer;
    if (!destination) return;
    const audio = host.querySelector("audio");
    const wasPlaying = audio && !audio.paused;
    destination.appendChild(host);
    // Browsers may pause media when its DOM parent changes; retain playback.
    if (wasPlaying && audio.paused) void audio.play().catch(() => undefined);
  }, [container, host, inlineContainer]);
  useEffect(() => () => { host.remove(); }, [host]);
  return <>
    <div className={container ? "hidden" : className} ref={setInlineContainer} />
    {createPortal(<div onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>{children}</div>, host)}
  </>;
}
