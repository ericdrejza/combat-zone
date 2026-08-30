import { useEffect, useState } from "react";

export const TOUCH_PRIMARY_INPUT_QUERY = "(hover: none) and (pointer: coarse)";

function getInitialTouchPrimaryInput(): boolean {
  return typeof window !== "undefined" && (
    Boolean(window.matchMedia?.(TOUCH_PRIMARY_INPUT_QUERY).matches) ||
    navigator.maxTouchPoints > 0
  );
}

/** Keeps mobile controls reachable when a phone requests a wide desktop viewport. */
export function useMobileControls(compactLayout: boolean): boolean {
  const [touchPrimaryInput, setTouchPrimaryInput] = useState(
    getInitialTouchPrimaryInput
  );

  useEffect(() => {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia(TOUCH_PRIMARY_INPUT_QUERY);
    const updateFromMediaQuery = () => setTouchPrimaryInput(
      mediaQuery.matches || navigator.maxTouchPoints > 0
    );
    updateFromMediaQuery();
    mediaQuery.addEventListener("change", updateFromMediaQuery);

    return () => mediaQuery.removeEventListener("change", updateFromMediaQuery);
  }, []);

  return compactLayout || touchPrimaryInput;
}
