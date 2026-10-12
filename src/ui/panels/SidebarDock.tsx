import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { EncounterHistoryControls } from "@ui/history/EncounterHistoryControls";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { DockSide } from "./PanelsShell";

export type SidebarDockProps = {
  children: ReactNode;
  collapsed: boolean;
  footer?: ReactNode;
  hideToggle?: boolean;
  onToggle: () => void;
  side: DockSide;
};

export function SidebarDock({
  children,
  collapsed,
  footer,
  hideToggle = false,
  onToggle,
  side
}: SidebarDockProps) {
  const collapseLabel =
    side === "left" ? "Collapse left sidebar" : "Collapse right sidebar";
  const expandLabel =
    side === "left" ? "Expand left sidebar" : "Expand right sidebar";
  const ToggleIcon =
    side === "left"
      ? collapsed
        ? ChevronLeft
        : ChevronRight
      : collapsed
        ? ChevronRight
        : ChevronLeft;

  return (
    <aside
      aria-label={`${side} sidebar`}
      className="flex min-h-0 flex-col gap-2 overflow-hidden"
    >
      <div className={`flex gap-2 ${collapsed || hideToggle ? "flex-col" : "items-center"} ${side === "right" ? "self-end" : "self-start"}`}>
      {hideToggle ? null : <TouchTooltip label={collapsed ? expandLabel : collapseLabel}><button
        title={collapsed ? expandLabel : collapseLabel}
        aria-expanded={!collapsed}
        aria-label={collapsed ? expandLabel : collapseLabel}
        className={`flex h-10 w-10 shrink-0 items-center justify-center ${
          side === "left" ? "self-start" : "self-end"
        } rounded-full border border-canvas-line bg-canvas-panel text-canvas-muted shadow-sm hover:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink`}
        onClick={onToggle}
        type="button"
      >
        <ToggleIcon aria-hidden="true" className="h-5 w-5" />
      </button></TouchTooltip>}
      {side === "left" ? <EncounterHistoryControls vertical={collapsed || hideToggle} /> : null}
      </div>
      {collapsed ? null : children}
      {footer ? (
        <div className={collapsed ? "mt-auto" : "mt-auto pt-1"}>{footer}</div>
      ) : null}
    </aside>
  );
}
