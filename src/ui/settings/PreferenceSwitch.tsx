import { motion } from "motion/react";

export function PreferenceSwitch({
  ariaLabel,
  checked,
  label,
  onChange
}: {
  ariaLabel?: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3">
      <span className="text-sm">{label}</span>
      <button
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
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
