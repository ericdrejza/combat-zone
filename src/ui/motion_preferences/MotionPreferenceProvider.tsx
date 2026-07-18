import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";

export const MOTION_OVERRIDE_STORAGE_KEY =
  "combat-zone.animation-effects-enabled";

type MotionPreference = {
  animationsDisabled: boolean;
  enableAnimations: () => void;
  systemPrefersReducedMotion: boolean;
};

const defaultMotionPreference: MotionPreference = {
  animationsDisabled: false,
  enableAnimations: () => undefined,
  systemPrefersReducedMotion: false
};

const MotionPreferenceContext = createContext<MotionPreference>(
  defaultMotionPreference
);

function getStoredAnimationOverride(): boolean {
  try {
    return localStorage.getItem(MOTION_OVERRIDE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function useSystemReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() =>
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    );

    if (!mediaQuery) {
      return;
    }

    const handleChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);

    setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

/** Resolves the system accessibility preference with an explicit app override. */
export function MotionPreferenceProvider({
  children
}: {
  children: ReactNode;
}) {
  const systemPrefersReducedMotion = useSystemReducedMotion();
  const [animationsEnabledOverride, setAnimationsEnabledOverride] = useState(
    getStoredAnimationOverride
  );

  function enableAnimations() {
    setAnimationsEnabledOverride(true);

    try {
      localStorage.setItem(MOTION_OVERRIDE_STORAGE_KEY, "true");
    } catch {
      // Storage can be unavailable in privacy-restricted contexts. The
      // in-memory override still applies for the current session.
    }
  }

  return (
    <MotionPreferenceContext.Provider
      value={{
        animationsDisabled:
          systemPrefersReducedMotion && !animationsEnabledOverride,
        enableAnimations,
        systemPrefersReducedMotion
      }}
    >
      {children}
    </MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference(): MotionPreference {
  return useContext(MotionPreferenceContext);
}
