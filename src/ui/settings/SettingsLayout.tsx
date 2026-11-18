import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

export const SETTINGS_CONTROL = "min-h-9 w-full min-w-0 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-1.5 text-sm enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-canvas-muted disabled:opacity-50";
export const SETTINGS_SLIDER = "min-h-9 w-full cursor-grab accent-canvas-ink enabled:hover:accent-canvas-muted active:cursor-grabbing focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50";
export const SETTINGS_BUTTON = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm font-medium enabled:hover:bg-canvas enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-canvas-muted disabled:opacity-50";

type GroupProps = { title: string; description?: ReactNode; children: ReactNode };

/** Keeps every category header and content width consistent across tabs. */
export function SettingsCategory({ title, description, children, actions }: GroupProps & { actions?: ReactNode }) {
  const id = useId();
  return <section aria-labelledby={id} className="mx-auto w-full max-w-3xl min-w-0 space-y-5 p-3 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><h3 id={id} className="font-display text-xl font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm text-canvas-muted">{description}</p> : null}
      </div>{actions}
    </header>{children}
  </section>;
}

export function SettingsSection({ title, titleSuffix, description, children, region = false, danger = false }: GroupProps & { titleSuffix?: string; region?: boolean; danger?: boolean }) {
  const id = useId();
  return <section aria-labelledby={id} role={region ? "region" : "group"} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${danger ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-canvas-line bg-canvas-surface"}`}>
    <h4 id={id} className={`text-base font-semibold ${danger ? "text-red-900 dark:text-red-400" : "text-canvas-ink"}`}>{title}{titleSuffix ? <span className="font-normal text-canvas-muted"> {titleSuffix}</span> : null}</h4>
    {description ? <p className="mt-1 text-xs text-canvas-muted">{description}</p> : null}
    <div className="mt-3 min-w-0 space-y-2">{children}</div>
  </section>;
}

export function SettingsSubsection({ title, description, children, region = false }: GroupProps & { region?: boolean }) {
  const id = useId();
  return <section aria-labelledby={id} role={region ? "region" : "group"} className="min-w-0 border-l-2 border-canvas-line pl-3 pt-1 sm:pl-4">
    <h5 id={id} className="text-sm font-semibold text-canvas-ink">{title}</h5>
    {description ? <p className="mt-1 text-xs text-canvas-muted">{description}</p> : null}
    <div className="mt-2 min-w-0 space-y-1">{children}</div>
  </section>;
}

/** Descriptions follow the entire field so help text never shifts label/control alignment. */
export function SettingsRow({ label, description, children, fullWidth = false, valueLabel, controlId, descriptionId, compact = false, inline = false, wrap = false, alignment = "baseline", labelClassName = "" }: {
  label: ReactNode; description?: ReactNode; children: ReactNode; fullWidth?: boolean;
  valueLabel?: ReactNode; controlId?: string; descriptionId?: string; compact?: boolean; inline?: boolean; wrap?: boolean;
  alignment?: "baseline" | "center" | "start"; labelClassName?: string;
}) {
  const layout = compact
    ? "flex items-center justify-between gap-3"
    : inline
      ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:gap-x-4"
      : wrap
        ? "flex flex-wrap items-baseline gap-x-4 gap-y-2"
        : fullWidth
          ? "space-y-2"
          : `grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:gap-x-4 ${alignment === "center" ? "sm:items-center" : alignment === "start" ? "sm:items-start" : "sm:items-baseline"}`;
  return <div className={`min-w-0 ${compact ? "py-1" : "py-2"}`}>
    <div className={`min-w-0 ${layout}`}>
      <div className={`flex min-w-0 items-baseline justify-between gap-3 ${compact ? "flex-1" : wrap ? "flex-1 basis-48" : ""}`}>
        {controlId ? <label htmlFor={controlId} className={`min-w-0 break-words text-sm font-medium ${labelClassName}`}>{label}</label> : <span className={`min-w-0 break-words text-sm font-medium ${labelClassName}`}>{label}</span>}
        {valueLabel !== undefined ? <span className="shrink-0 text-sm tabular-nums text-canvas-muted">{valueLabel}</span> : null}
      </div>
      <div className={wrap ? "w-56 min-w-0 max-w-full shrink-0" : "min-w-0"}>{children}</div>
    </div>
    {description ? <p id={descriptionId} className="mt-1 text-xs text-canvas-muted">{description}</p> : null}
  </div>;
}

/** Associates native controls with labels and help without changing their save handlers. */
export function SettingsField({ label, description, children, fullWidth, valueLabel }: {
  label: string; description?: ReactNode; children: ReactElement; fullWidth?: boolean; valueLabel?: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const child = children as ReactElement<Record<string, unknown>>;
  const control = cloneElement(child, {
    id, "aria-describedby": [child.props["aria-describedby"], description ? helpId : null].filter(Boolean).join(" ") || undefined
  });
  return <SettingsRow label={label} description={description} controlId={id} descriptionId={helpId} fullWidth={fullWidth} valueLabel={valueLabel}
    alignment={child.props.type === "range" ? "center" : "baseline"}>{control}</SettingsRow>;
}
