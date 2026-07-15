import { useEffect, useState } from "react";

/** Tracks Alt globally because the key changes canvas visuals without focus. */
export function useAltKey() {
  const [altKeyDown, setAltKeyDown] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setAltKeyDown(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setAltKeyDown(false);
      }
    }

    function handleWindowBlur() {
      setAltKeyDown(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  return altKeyDown;
}
