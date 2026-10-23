import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState
} from "react";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";

export const THEME_STORAGE_KEY = "combat-zone.theme";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

type ThemeContextValue = {
  setTheme: (theme: ThemePreference) => void;
  themePreference: ThemePreference;
  theme: Theme;
};

const defaultValue: ThemeContextValue = {
  setTheme: () => undefined,
  themePreference: "system",
  theme: "light"
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

function readTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

/** Owns the durable interface theme without adding it to encounter history. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemeState] = useState<ThemePreference>(readTheme);
  const [systemDark, setSystemDark] = useState(() =>
    globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const theme: Theme = themePreference === "system" ? systemDark ? "dark" : "light" : themePreference;

  useLayoutEffect(() => {
    const media = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    const reset = () => setThemeState("system");
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setThemeState(readTheme());
    };
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
    globalThis.addEventListener("storage", syncFromStorage);
    return () => {
      globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
      globalThis.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  function setTheme(nextTheme: ThemePreference) {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The in-memory preference remains usable when storage is unavailable.
    }
  }

  return (
    <ThemeContext.Provider value={{ setTheme, theme, themePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
