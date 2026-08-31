import {
  ArrowLeftRight,
  ArrowRight,
  Activity,
  Ban,
  ChevronsDown,
  CornerDownRight,
  Dices,
  Eye,
  EyeDashed,
  EyeOff,
  MoveRight,
  RotateCcw,
  Spline,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { createPortal } from "react-dom";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { deleteAllEdges } from "@entities/edge/edgeMutations";
import type { EdgeMovementRule } from "@entities/edge/types";
import {
  clearSelection,
  resetEdgePreset,
  setActiveTool,
  setEdgeDirectionality,
  setEdgeShape,
  setEdgeVisibilityRule,
  toggleEdgeMovementRule
} from "@interaction/interactionState";
import type { ToolDefinition, ToolId } from "@interaction/tools/toolRegistry";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup,
  ToolbarOptionRow,
  ToolbarSubtoolBar
} from "../ToolbarOption";
import { TOOL_ICONS } from "../toolbarItems";
import { TouchTooltip } from "../TouchTooltip";

type Props = {
  activeToolId: ToolId;
  compactLayout: boolean;
  compactSubtoolHost: HTMLDivElement | null;
  edgeTool: RootState["interaction"]["edgeTool"];
  encounter: RootState["encounter"]["present"];
  tool: ToolDefinition;
};

const movementOptions = [
  { icon: Ban, label: "Blocked", value: "blocked" },
  { icon: Dices, label: "Skill check", value: "skillCheck" },
  { icon: ChevronsDown, label: "Difficult", value: "difficult" }
] as const;

export function EdgeToolButton({ activeToolId, compactLayout, compactSubtoolHost, edgeTool, encounter, tool }: Props) {
  const dispatch = useDispatch();
  const [confirmClear, setConfirmClear] = useState(false);
  const selected = activeToolId === "edge";

  function optionButton(
    label: string,
    active: boolean,
    Icon: typeof MoveRight,
    onClick: () => void,
    role: "radio" | undefined = undefined
  ) {
    return (
      <ToolbarOptionButton
        key={label}
        active={active}
        aria-checked={role ? active : undefined}
        aria-label={label}
        aria-pressed={role ? undefined : active}
        onClick={onClick}
        role={role}
        title={label}
        type="button"
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
    );
  }

  function renderOptions() {
    return (
      <>
        <ToolbarOptionGroup aria-label="Edge directionality" role="radiogroup">
          {optionButton("Bilateral", edgeTool.directionality === "bilateral", ArrowLeftRight, () => dispatch(setEdgeDirectionality("bilateral")), "radio")}
          {optionButton("Unilateral", edgeTool.directionality === "unilateral", ArrowRight, () => dispatch(setEdgeDirectionality("unilateral")), "radio")}
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Edge movement rules">
          {movementOptions.map(({ icon, label, value }) => optionButton(label, edgeTool.movementRules.includes(value as EdgeMovementRule), icon, () => dispatch(toggleEdgeMovementRule(value as EdgeMovementRule))))}
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Edge visibility" role="radiogroup">
          {optionButton("Visible", edgeTool.visibilityRule === "visible", Eye, () => dispatch(setEdgeVisibilityRule("visible")), "radio")}
          {optionButton("Obscured", edgeTool.visibilityRule === "obscured", EyeDashed, () => dispatch(setEdgeVisibilityRule("obscured")), "radio")}
          {optionButton("Hidden", edgeTool.visibilityRule === "hidden", EyeOff, () => dispatch(setEdgeVisibilityRule("hidden")), "radio")}
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Edge shape" role="radiogroup">
          {optionButton("Straight", edgeTool.shape === "straight", MoveRight, () => dispatch(setEdgeShape("straight")), "radio")}
          {optionButton("Right angled", edgeTool.shape === "rightAngled", CornerDownRight, () => dispatch(setEdgeShape("rightAngled")), "radio")}
          {optionButton("Curved", edgeTool.shape === "curved", Spline, () => dispatch(setEdgeShape("curved")), "radio")}
          {optionButton("Sigmoid", edgeTool.shape === "sigmoid", Activity, () => dispatch(setEdgeShape("sigmoid")), "radio")}
        </ToolbarOptionGroup>
        <ToolbarOptionGroup aria-label="Edge actions">
          {optionButton("Reset edge defaults", false, RotateCcw, () => dispatch(resetEdgePreset()))}
          <ToolbarOptionButton
            aria-label="Clear all edges"
            disabled={encounter.edges.allIds.length === 0}
            onClick={() => setConfirmClear(true)}
            title="Clear all edges"
            type="button"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
        </ToolbarOptionGroup>
      </>
    );
  }

  const ToolIcon = TOOL_ICONS[tool.id];
  const optionBar = selected ? (
    <ToolbarSubtoolBar aria-label="Edge options">
      {renderOptions()}
    </ToolbarSubtoolBar>
  ) : null;

  return (
    <>
      <ToolbarOptionRow className="max-lg:contents">
        <TouchTooltip label={tool.tooltip}>
          <button
            aria-expanded={selected}
            aria-label={tool.label}
            aria-pressed={selected}
            className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border px-2 text-sm font-medium shadow-sm transition hover:bg-canvas lg:h-auto lg:min-w-0 lg:px-3 lg:py-1.5 ${selected ? "border-canvas-ink bg-canvas-ink text-white" : "border-canvas-line bg-white text-canvas-ink"}`}
            onClick={() => dispatch(setActiveTool("edge"))}
            title={tool.tooltip}
            type="button"
          >
            <ToolIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        </TouchTooltip>
        {!compactLayout ? optionBar : null}
      </ToolbarOptionRow>
      {compactLayout && compactSubtoolHost && optionBar
        ? createPortal(optionBar, compactSubtoolHost)
        : null}
      {confirmClear ? (
        <div aria-label="Confirm clear all edges" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-6" role="dialog">
          <div className="w-[min(26rem,92vw)] rounded-3xl border border-canvas-line bg-white p-5 shadow-2xl">
            <h3 className="font-display text-lg font-semibold">Clear all edges?</h3>
            <p className="mt-2 text-sm text-canvas-muted">This removes every edge from the encounter. You can undo this action.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-xl border border-canvas-line px-4 py-2 text-sm" onClick={() => setConfirmClear(false)} type="button">Cancel</button>
              <button className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => {
                const edgeIds = [...encounter.edges.allIds];
                dispatch(commitEncounterChange({ action: createEncounterActionRecord("edge.clearAll", { edgeIds }), nextEncounter: deleteAllEdges(encounter) }));
                dispatch(clearSelection());
                setConfirmClear(false);
              }} type="button">Clear all</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
