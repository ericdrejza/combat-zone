import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { DockSide } from "./PanelsShell";

export type SidebarDockProps = {
  children: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  side: DockSide;
};

export function SidebarDock({
  children,
  collapsed,
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
      <button
        aria-expanded={!collapsed}
        aria-label={collapsed ? expandLabel : collapseLabel}
        className={`flex h-10 w-10 shrink-0 items-center justify-center ${
          side === "left" ? "self-start" : "self-end"
        } rounded-full border border-canvas-line bg-canvas-panel text-canvas-muted shadow-sm transition hover:bg-white`}
        onClick={onToggle}
        type="button"
      >
        <ToggleIcon aria-hidden="true" className="h-5 w-5" />
      </button>
      {collapsed ? null : children}
    </aside>
  );
}
