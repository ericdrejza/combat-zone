import { useEffect, useState } from "react";

import { matchesKeybind } from "@ui/keybinds";

/** Tracks a configurable shortcut while its key is held for transient canvas visuals. */
export function useHeldKeybind(binding: string): boolean {
  const [isHeld, setIsHeld] = useState(false);

  useEffect(() => {
    setIsHeld(false);

    function handleKeyDown(event: KeyboardEvent) {
      if (matchesKeybind(event, binding)) {
        setIsHeld(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (matchesKeybind(event, binding)) {
        setIsHeld(false);
      }
    }

    function handleWindowBlur() {
      setIsHeld(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [binding]);

  return isHeld;
}
