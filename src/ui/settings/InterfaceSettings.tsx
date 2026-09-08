import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
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
  const {
    autoSelectActiveActor,
    panWithRightClickDrag,
    setAutoSelectActiveActor,
    setPanWithRightClickDrag
  } = useInterfacePreferences();

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
      <fieldset className="mt-7 max-w-lg border-t border-canvas-line pt-5">
        <legend className="pr-3 text-sm font-semibold">General</legend>
        <div className="mt-1 divide-y divide-canvas-line">
          <PreferenceSwitch
            checked={panWithRightClickDrag}
            label="Pan with right-click drag"
            onChange={setPanWithRightClickDrag}
          />
        </div>
      </fieldset>
      <fieldset className="mt-4 max-w-lg border-t border-canvas-line pt-5">
        <legend className="pr-3 text-sm font-semibold">Defaults</legend>
        <div className="mt-1 divide-y divide-canvas-line">
          <PreferenceSwitch
            checked={autoSelectActiveActor}
            label="Auto-select active actor in initiative"
            onChange={setAutoSelectActiveActor}
          />
        </div>
      </fieldset>
    </section>
  );
}

function PreferenceSwitch({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3">
      <span className="text-sm">{label}</span>
      <button
        aria-checked={checked}
        aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked
            ? "border-canvas-ink bg-canvas-ink"
            : "border-canvas-line bg-canvas"
        }`}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full ${
            checked ? "bg-canvas-on-ink" : "bg-canvas-muted"
          }`}
          initial={false}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      </button>
    </div>
  );
}
