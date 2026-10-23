import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme, type ThemePreference } from "@ui/theme/ThemeProvider";
import { SettingsRow } from "./SettingsLayout";

const themeOptions: Array<{
  icon: typeof Sun;
  label: string;
  value: ThemePreference;
}> = [
  { icon: Monitor, label: "System", value: "system" },
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" }
];

export function ThemeSettings() {
  const { setTheme, themePreference } = useTheme();
  return <SettingsRow label="Theme" fullWidth>
        <div className="relative grid w-full max-w-xs grid-cols-3 rounded-2xl border border-canvas-line bg-canvas p-1" role="radiogroup" aria-label="Theme">
          <motion.span
            animate={{ x: `${themeOptions.findIndex(option => option.value === themePreference) * 100}%` }}
            aria-hidden="true"
            className="absolute bottom-1 left-1 top-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-canvas-ink shadow-sm"
            initial={false}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
          {themeOptions.map(({ icon: Icon, label, value }) => (
            <label
              className={`relative z-10 flex cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-canvas-ink focus-within:ring-offset-2 focus-within:ring-offset-canvas ${
                themePreference === value
                  ? "text-canvas-on-ink hover:ring-2 hover:ring-canvas-muted"
                  : "text-canvas-muted hover:text-canvas-ink"
              }`}
              key={value}
            >
              <input
                checked={themePreference === value}
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
  </SettingsRow>;
}
