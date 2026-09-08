import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

import { useTheme, type Theme } from "@ui/theme/ThemeProvider";

const themeOptions: Array<{
  icon: typeof Sun;
  label: string;
  value: Theme;
}> = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" }
];

/** Presents the mutually exclusive visual themes as one keyboard-friendly control. */
export function InterfaceSettings() {
  const { setTheme, theme } = useTheme();

  return (
    <section aria-labelledby="settings-interface-heading" className="p-5">
      <h3 className="font-display text-lg font-semibold" id="settings-interface-heading">
        Interface
      </h3>
      <p className="mt-1 text-sm text-canvas-muted">
        Choose the color theme used throughout Combat Zone.
      </p>
      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold">Theme</legend>
        <div className="relative grid w-full max-w-xs grid-cols-2 rounded-2xl border border-canvas-line bg-canvas p-1" role="radiogroup">
          <motion.span
            animate={{ x: theme === "dark" ? "100%" : "0%" }}
            aria-hidden="true"
            className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-xl bg-canvas-ink shadow-sm"
            initial={false}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
          {themeOptions.map(({ icon: Icon, label, value }) => (
            <label
              className={`relative z-10 flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-canvas-ink focus-within:ring-offset-2 focus-within:ring-offset-canvas ${
                theme === value
                  ? "text-canvas-on-ink"
                  : "text-canvas-muted hover:text-canvas-ink"
              }`}
              key={value}
            >
              <input
                checked={theme === value}
                className="sr-only"
                name="interface-theme"
                onChange={() => setTheme(value)}
                type="radio"
                value={value}
              />
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
