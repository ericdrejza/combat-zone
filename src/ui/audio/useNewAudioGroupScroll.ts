import { animate } from "motion/react";
import { useLayoutEffect, useRef, type RefObject } from "react";

import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";

/** Reveal newly created groups after their complete contents mount, below the sticky header. */
export function useNewAudioGroupScroll(groupIds: string[], scrollRef: RefObject<HTMLDivElement>) {
  const previousIds = useRef(new Set(groupIds));
  const pendingId = useRef<string | null>(null);
  const { animationsDisabled } = useMotionPreference();
  useLayoutEffect(() => {
    const added = groupIds.filter((id) => !previousIds.current.has(id));
    previousIds.current = new Set(groupIds);
    if (added.length) pendingId.current = added.at(-1)!;
    const root = scrollRef.current;
    const group = root && Array.from(root.querySelectorAll<HTMLElement>("[data-audio-group-id]")).find((element) => element.dataset.audioGroupId === pendingId.current);
    if (!root || !group) return;
    const bounds = root.getBoundingClientRect();
    const target = group.getBoundingClientRect();
    const headerHeight = root.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const top = bounds.top + headerHeight + 12;
    const bottom = bounds.bottom - 12;
    let destination = root.scrollTop;
    if (target.height > bottom - top || target.top < top) destination += target.top - top;
    else if (target.bottom > bottom) destination += target.bottom - bottom;
    destination = Math.min(Math.max(0, root.scrollHeight - root.clientHeight), Math.max(0, destination));
    if (animationsDisabled || destination === root.scrollTop) { root.scrollTop = destination; pendingId.current = null; return; }
    const animation = animate(root.scrollTop, destination, {
      duration: 0.2, ease: "easeOut",
      onUpdate: (value) => { root.scrollTop = value; },
      onComplete: () => { pendingId.current = null; }
    });
    return () => animation.stop();
  }, [groupIds, scrollRef, animationsDisabled]);
}
