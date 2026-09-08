import { Activity, Ban, ChevronsDown, CornerDownRight, Dices, Eye, EyeDashed, EyeOff, MoveRight, Spline, Trash2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { deleteEdges, updateEdges } from "@entities/edge/edgeMutations";
import type { Edge, EdgeMovementRule, EdgeShape, EdgeVisibilityRule } from "@entities/edge/types";
import { clearSelection } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";
import { EdgeTagEditor } from "./edge_properties/EdgeTagEditor";

const movementOptions = [
  { icon: Ban, label: "Blocked", value: "blocked" },
  { icon: Dices, label: "Skill check", value: "skillCheck" },
  { icon: ChevronsDown, label: "Difficult", value: "difficult" }
] as const;
const visibilityOptions: Array<{ icon: typeof Eye; label: string; value: EdgeVisibilityRule }> = [
  { icon: Eye, label: "Visible", value: "visible" },
  { icon: EyeDashed, label: "Obscured", value: "obscured" },
  { icon: EyeOff, label: "Hidden", value: "hidden" }
];
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
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const edgeIds = selection.selectedEntityType === "edge" ? selection.selectedIds : [];
  const edges = edgeIds.map((id) => encounter.edges.byId[id]).filter((edge): edge is Edge => Boolean(edge));
  if (edges.length === 0) return <p className="text-sm text-canvas-muted">Select an edge to edit its rules, shape, tags, or notes.</p>;

  function commit(nextEncounter: typeof encounter, properties: JsonObject) {
    if (nextEncounter === encounter) return;
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("edge.updateProperties", { edgeIds, properties }),
      currentEncounter: encounter,
      nextEncounter
    });
    const finish = (resolved: Awaited<typeof prepared>) => {
      if (!logEncounterValidationBlock(dispatch, resolved)) dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
    };
    if (prepared instanceof Promise) void prepared.then(finish); else finish(prepared);
  }

  function toggleMovement(rule: EdgeMovementRule) {
    const remove = edges.every((edge) => edge.movementRules.includes(rule));
    const next = edges.reduce((state, edge) => updateEdges(state, [edge.id], {
      movementRules: remove ? edge.movementRules.filter((item) => item !== rule) : [...new Set([...edge.movementRules, rule])]
    }), encounter);
    commit(next, { movementRule: rule, operation: remove ? "remove" : "add" });
  }

  const visibility = uniqueValue(edges, (edge) => edge.visibilityRule);
  const shape = uniqueValue(edges, (edge) => edge.shape);
  const first = edges[0];
  const fromName = encounter.zones.byId[first.fromZoneId]?.name ?? first.fromZoneId;
  const toName = encounter.zones.byId[first.toZoneId]?.name ?? first.toZoneId;
  const buttonClass = (active: boolean) => `flex h-9 min-w-9 items-center justify-center rounded-full border px-2 ${active ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted"}`;

  return <div className="space-y-4 text-sm">
    <div><p className="font-semibold text-canvas-ink">Connection</p><p className="text-canvas-muted">{edges.length === 1 ? `${fromName} ${first.directionality === "bilateral" ? "↔" : "→"} ${toName} · ${first.directionality}` : `${edges.length} edges selected`}</p></div>
    <fieldset><legend className="mb-1 font-semibold text-canvas-ink">Movement</legend><div className="flex gap-2">
      {movementOptions.map(({ icon: Icon, label, value }) => {
        const count = edges.filter((edge) => edge.movementRules.includes(value)).length;
        return <button key={value} aria-label={label} aria-pressed={count === edges.length} className={buttonClass(count === edges.length)} data-mixed={count > 0 && count < edges.length || undefined} onClick={() => toggleMovement(value)} title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button>;
      })}
    </div></fieldset>
    <fieldset><legend className="mb-1 font-semibold text-canvas-ink">Visibility</legend><div className="flex gap-2">
      {visibilityOptions.map(({ icon: Icon, label, value }) => <button key={value} aria-checked={visibility === value} aria-label={label} className={buttonClass(visibility === value)} onClick={() => commit(updateEdges(encounter, edgeIds, { visibilityRule: value }), { visibilityRule: value })} role="radio" title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button>)}
    </div></fieldset>
    <fieldset><legend className="mb-1 font-semibold text-canvas-ink">Shape</legend><div className="flex gap-2">
      {shapeOptions.map(({ icon: Icon, label, value }) => <button key={value} aria-checked={shape === value} aria-label={label} className={buttonClass(shape === value)} onClick={() => commit(updateEdges(encounter, edgeIds, { shape: value }), { shape: value })} role="radio" title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button>)}
    </div></fieldset>
    {edges.length === 1 ? <>
      <EdgeTagEditor
        onChange={(interactionTags) => commit(
          updateEdges(encounter, edgeIds, { interactionTags }),
          { interactionTags }
        )}
        tags={first.interactionTags}
      />
      <label className="block space-y-1"><span className="font-semibold text-canvas-ink">Notes</span><textarea className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2" defaultValue={first.notes ?? ""} onBlur={(event) => { if (event.currentTarget.value !== (first.notes ?? "")) commit(updateEdges(encounter, edgeIds, { notes: event.currentTarget.value }), { notes: event.currentTarget.value }); }} rows={3} /></label>
    </> : <p className="text-canvas-muted">Select one edge to edit tags and notes.</p>}
    <button className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700" onClick={() => { dispatch(commitEncounterChange({ action: createEncounterActionRecord("edge.delete", { edgeIds }), nextEncounter: deleteEdges(encounter, edgeIds) })); dispatch(clearSelection()); }} type="button"><Trash2 aria-hidden="true" className="h-4 w-4" />Delete {edges.length === 1 ? "edge" : `${edges.length} edges`}</button>
  </div>;
}
