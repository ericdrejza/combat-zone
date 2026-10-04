import { ClockStyleSelect } from "@ui/controls/ClockStyleSelect";
import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { DOCKABLE_PANEL_DEFINITIONS } from "@ui/panels/dockablePanelMetadata";
import { useTheme, type Theme } from "@ui/theme/ThemeProvider";
import { ApplyPanelOrderButton } from "./ApplyPanelOrderButton";
import { DefaultColorSettings } from "./DefaultColorSettings";
import { VisibilitySwitch } from "./VisibilitySwitch";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { PanelOrderSettings } from "./PanelOrderSettings";

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
    healthCounterName, setHealthCounterName,
    clockStyleDefault, setClockStyleDefault,
    autoSelectActiveActorDefault,
    enableAssetAnimation,
    encounterCreationTool,
    panelOrder,
    panelVisibility,
    panWithRightClickDrag,
    strikethroughDeadInitiativeNames,
    setAutoSelectActiveActorDefault,
    setEnableAssetAnimation,
    setEncounterCreationTool,
    setPanelOrder,
    setPanelVisible,
    setPanWithRightClickDrag,
    setStrikethroughDeadInitiativeNames
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
        <legend className="pr-3 text-sm font-semibold">Accessibility</legend>
        <div className="mt-1 divide-y divide-canvas-line">
          <PreferenceSwitch
            checked={enableAssetAnimation}
            label="Enable animations"
            onChange={setEnableAssetAnimation}
          />
        </div>
      </fieldset>
      <fieldset className="mt-4 max-w-lg border-t border-canvas-line pt-5">
        <legend className="pr-3 text-sm font-semibold">Navigation</legend>
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
          <label className="flex min-h-12 items-center justify-between gap-4 py-3">
            <span className="text-sm">Tool auto-select upon encounter creation</span>
            <select
              aria-label="Tool auto-select upon encounter creation"
              className="rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm"
              onChange={(event) =>
                setEncounterCreationTool(
                  event.currentTarget.value as "background" | "zone"
                )
              }
              value={encounterCreationTool}
            >
              <option value="background">Background</option>
              <option value="zone">Zone</option>
            </select>
          </label>
          <PreferenceSwitch
            checked={autoSelectActiveActorDefault}
            label="Auto-select active actor in initiative"
            onChange={setAutoSelectActiveActorDefault}
          />
          <ClockStyleSelect label="Default clock style" value={clockStyleDefault} onChange={setClockStyleDefault} />
          <DefaultColorSettings />
        </div>
      </fieldset>
      <section aria-labelledby="interface-panels-heading" className="mt-4 border-t border-canvas-line pt-5">
        <h4 className="text-sm font-semibold" id="interface-panels-heading">Panels</h4>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] lg:gap-6">
          <fieldset className="min-w-0">
            <legend className="text-sm font-semibold">Visibility</legend>
            <div className="mt-1 divide-y divide-canvas-line">
              {DOCKABLE_PANEL_DEFINITIONS.map((panel) => (
                <VisibilitySwitch
                  key={panel.id}
                  label={panel.title}
                  ariaLabel={`${panel.title} panel visibility`}
                  tooltipLabel={`${panel.title} panel`}
                  visible={panelVisibility[panel.id]}
                  onChange={(visible) => setPanelVisible(panel.id, visible)}
                />
              ))}
            </div>
          </fieldset>
          <div aria-hidden="true" className="hidden w-px bg-canvas-line lg:block" />
          <fieldset className="min-w-0">
            <legend className="text-sm font-semibold">Order</legend>
            <p className="mb-3 mt-1 text-xs text-canvas-muted">Default sides and order for new encounters.</p>
            <PanelOrderSettings onChange={setPanelOrder} order={panelOrder} />
            <ApplyPanelOrderButton order={panelOrder} />
          </fieldset>
        </div>
        <div className="mt-5 max-w-lg border-t border-canvas-line">
          <PreferenceSwitch
            checked={strikethroughDeadInitiativeNames}
            label="Strikethrough dead actor names in initiative"
            onChange={setStrikethroughDeadInitiativeNames}
          />
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-sm">Health counter name
          <input aria-label="Health counter name" className="w-40 rounded border border-canvas-line bg-canvas p-2" defaultValue={healthCounterName} key={healthCounterName} onBlur={(event) => setHealthCounterName(event.currentTarget.value)} />
        </label>
      </section>
    </section>
  );
}
