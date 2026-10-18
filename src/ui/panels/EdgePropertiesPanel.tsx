import { ColorPalettePicker } from "@ui/controls/ColorPalettePicker";
import { getFallbackCanvasLuminance, getTextColorForLuminance } from "@ui/canvas/canvasLuminance";
import { useTheme } from "@ui/theme/ThemeProvider";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { consumeEncounterChange } from "@store/consumeEncounterChange";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { Activity, CornerDownRight, MoveRight, RotateCcw, Spline, Trash2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/runtimeEncounterChange";
import { deleteEdges, updateEdges } from "@entities/edge/edgeMutations";
import type { Edge, EdgeShape } from "@entities/edge/types";
import { clearSelection } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";

const shapeOptions: Array<{ icon: typeof MoveRight; label: string; value: EdgeShape }> = [
  { icon: MoveRight, label: "Straight", value: "straight" },
  { icon: CornerDownRight, label: "Right angled", value: "rightAngled" },
  { icon: Spline, label: "Curved", value: "curved" },
  { icon: Activity, label: "Sigmoid", value: "sigmoid" }
];

function uniqueValue<T>(edges: Edge[], getter: (edge: Edge) => T): T | undefined {
  const first = edges[0] ? getter(edges[0]) : undefined;
  return edges.every((edge) => getter(edge) === first) ? first : undefined;
}

export function EdgePropertiesPanel() {
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const { readOnly } = usePersistence();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const edgeIds = selection.selectedEntityType === "edge" ? selection.selectedIds : [];
  const edges = edgeIds.map((id) => encounter.edges.byId[id]).filter((edge): edge is Edge => Boolean(edge));
  if (edges.length === 0) return <p className="text-sm text-canvas-muted">Select an edge to edit its shape.</p>;

  function commit(nextEncounter: typeof encounter, properties: JsonObject) {
    if (readOnly || nextEncounter === encounter) return;
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("edge.updateProperties", { edgeIds, properties }),
      currentEncounter: encounter,
      nextEncounter
    });
    const finish = (resolved: Awaited<typeof prepared>) => {
      if (!logEncounterValidationBlock(dispatch, resolved)) dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
    };
    void consumeEncounterChange(prepared, encounter, dispatch, finish);
  }

  const shape = uniqueValue(edges, (edge) => edge.shape);
  const resettableIds = edges.filter(edge => edge.routePreferences &&
    (edge.routePreferences.flipped || edge.routePreferences.curvature !== 1)).map(edge => edge.id);
  const first = edges[0];
  const fromName = encounter.zones.byId[first.fromZoneId]?.name ?? first.fromZoneId;
  const toName = encounter.zones.byId[first.toZoneId]?.name ?? first.toZoneId;
  const buttonClass = (active: boolean) => `flex h-9 min-w-9 items-center justify-center rounded-full border px-2 enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted"}`;

  return <div className="space-y-4 text-sm">
    <div><p className="font-semibold text-canvas-ink">Connection</p><p className="text-canvas-muted">{edges.length === 1 ? `${fromName} ${first.directionality === "bilateral" ? "↔" : "→"} ${toName} · ${first.directionality}` : `${edges.length} edges selected`}</p></div>
    <fieldset><legend className="mb-1 font-semibold text-canvas-ink">Shape</legend><div className="flex gap-2">
      {shapeOptions.map(({ icon: Icon, label, value }) => <TouchTooltip key={value} label={label}><button disabled={readOnly} aria-checked={shape === value} aria-label={label} className={buttonClass(shape === value)} onClick={() => commit(updateEdges(encounter, edgeIds, { shape: value }), { shape: value })} role="radio" title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>)}
    </div></fieldset>
    <TouchTooltip label="Restore the default curvature and orientation for the current shape">
      <button aria-label="Reset edge curvature" title="Restore the default curvature and orientation for the current shape"
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-canvas-line px-3 py-2 enabled:hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50"
        disabled={readOnly || resettableIds.length === 0} type="button"
        onClick={() => {
          const routePreferences = { flipped: false, curvature: 1 };
          commit(updateEdges(encounter, resettableIds, { routePreferences }), { routePreferences });
        }}>
        <RotateCcw aria-hidden="true" className="h-4 w-4" />Reset curvature
      </button>
    </TouchTooltip>
    <section className="space-y-2 rounded-2xl border border-canvas-line bg-canvas-surface p-3">
      <ColorPalettePicker label="Edge color" disabled={readOnly}
        value={first.color ?? getTextColorForLuminance(getFallbackCanvasLuminance(theme))}
        displayValue={edges.some(edge => (edge.color ?? null) !== (first.color ?? null)) ? "Mixed" : first.color ? undefined : "Automatic"}
        onChange={color => { if (!edges.every(edge => edge.color === color)) commit(updateEdges(encounter, edgeIds, { color }), { color }); }} />
      <button className="rounded-lg border border-canvas-line px-3 py-2 enabled:hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50"
        disabled={readOnly || edges.every(edge => !edge.color)} type="button"
        onClick={() => commit(updateEdges(encounter, edgeIds, { color: null }), { color: null })}>Use automatic color</button>
    </section>
    <button className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700 transition enabled:hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-950 dark:text-red-500 dark:enabled:hover:bg-red-900" disabled={readOnly} onClick={() => { dispatch(commitEncounterChange({ action: createEncounterActionRecord("edge.delete", { edgeIds }), nextEncounter: deleteEdges(encounter, edgeIds) })); dispatch(clearSelection()); }} type="button"><Trash2 aria-hidden="true" className="h-4 w-4" />Delete {edges.length === 1 ? "edge" : `${edges.length} edges`}</button>
  </div>;
}
