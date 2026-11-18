import type { ButtonHTMLAttributes, ReactNode } from "react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
/** Shared accessible icon control with desktop and touch help. */
export function TooltipIconButton({ label, children, className = "", ...props }: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <TouchTooltip label={label}><button {...props} type="button" aria-label={label} title={label} className={`flex shrink-0 items-center justify-center rounded-lg border border-canvas-line p-2 enabled:hover:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40 ${className}`}>{children}</button></TouchTooltip>;
}
