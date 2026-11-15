import type { ReactNode } from "react";
import type { ToolId } from "@interaction/tools/toolRegistry";
import { TOOLBAR_ITEMS } from "./toolbarItems";

type Props = {
  dropdown: boolean;
  activeToolId: ToolId;
  onSelect: (tool: ToolId) => void;
  renderTool: (item: (typeof TOOLBAR_ITEMS)[number]) => ReactNode;
};

/** Keep tool components mounted so changing presentation preserves dialogs and drafts. */
export function ToolMenu({ dropdown, activeToolId, onSelect, renderTool }: Props) {
  return <>
    {dropdown ? <select aria-label="Choose tool" value={activeToolId}
      className="h-11 max-w-40 shrink-0 rounded-full border border-canvas-line bg-canvas-surface px-3 text-sm text-canvas-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink lg:h-auto lg:py-1.5"
      onChange={event => onSelect(event.currentTarget.value as ToolId)}>
      {TOOLBAR_ITEMS.map(item => item.type === "tool"
        ? <option key={item.tool.id} value={item.tool.id}>{item.tool.label}</option> : null)}
    </select> : null}
    {TOOLBAR_ITEMS.map(item => <div key={item.type === "tool" ? item.tool.id : item.id}
      hidden={dropdown && (item.type === "separator" || item.tool.id !== activeToolId)}
      className={dropdown && (item.type === "separator" || item.tool.id !== activeToolId) ? "hidden" : "contents"}>
      {renderTool(item)}
    </div>)}
  </>;
}
