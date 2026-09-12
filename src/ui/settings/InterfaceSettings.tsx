import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { DOCKABLE_PANEL_DEFINITIONS } from "@ui/panels/dockablePanelMetadata";
import { useTheme, type Theme } from "@ui/theme/ThemeProvider";
import { DefaultColorSettings } from "./DefaultColorSettings";
import { PreferenceSwitch } from "./PreferenceSwitch";

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
    autoSelectActiveActorDefault,
    panelVisibility,
    panWithRightClickDrag,
    setAutoSelectActiveActorDefault,
    setPanelVisible,
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
            checked={autoSelectActiveActorDefault}
            label="Auto-select active actor in initiative"
            onChange={setAutoSelectActiveActorDefault}
          />
          <DefaultColorSettings />
        </div>
      </fieldset>
      <fieldset className="mt-4 max-w-lg border-t border-canvas-line pt-5">
        <legend className="pr-3 text-sm font-semibold">Panel Visibility</legend>
        <div className="mt-1 divide-y divide-canvas-line">
          {DOCKABLE_PANEL_DEFINITIONS.map((panel) => (
            <PanelVisibilitySwitch
              key={panel.id}
              panelTitle={panel.title}
              visible={panelVisibility[panel.id]}
              onChange={(visible) => setPanelVisible(panel.id, visible)}
            />
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function PanelVisibilitySwitch({
  onChange,
  panelTitle,
  visible
}: {
  onChange: (visible: boolean) => void;
  panelTitle: string;
  visible: boolean;
}) {
  const Icon = visible ? Eye : EyeOff;

  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3">
      <span className="text-sm">{panelTitle}</span>
      <button
        aria-checked={visible}
        aria-label={`${panelTitle} panel visibility`}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
          visible
            ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
            : "border-canvas-line bg-canvas text-canvas-muted"
        }`}
        onClick={() => onChange(!visible)}
        role="switch"
        title={visible ? `Hide ${panelTitle} panel` : `Show ${panelTitle} panel`}
        type="button"
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
