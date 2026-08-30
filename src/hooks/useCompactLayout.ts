import { useEffect, useState } from "react";

export const COMPACT_LAYOUT_BREAKPOINT_PX = 1024;
export const COMPACT_LAYOUT_QUERY = `(width < ${COMPACT_LAYOUT_BREAKPOINT_PX}px)`;

function getInitialCompactLayout(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia
    ? window.matchMedia(COMPACT_LAYOUT_QUERY).matches
    : window.innerWidth < COMPACT_LAYOUT_BREAKPOINT_PX;
}

/** Keeps behavior and accessible DOM composition aligned with the lg breakpoint. */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(getInitialCompactLayout);

  useEffect(() => {
    if (!window.matchMedia) {
      const updateFromWidth = () =>
        setCompact(window.innerWidth < COMPACT_LAYOUT_BREAKPOINT_PX);
      window.addEventListener("resize", updateFromWidth);
      return () => window.removeEventListener("resize", updateFromWidth);
    }

    const mediaQuery = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const updateFromMediaQuery = () => setCompact(mediaQuery.matches);
    updateFromMediaQuery();
    mediaQuery.addEventListener("change", updateFromMediaQuery);

    return () => mediaQuery.removeEventListener("change", updateFromMediaQuery);
  }, []);

  return compact;
}
