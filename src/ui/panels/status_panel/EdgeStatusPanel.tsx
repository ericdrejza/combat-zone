import { Ban, ChevronsDown, Dices, Eye, EyeDashed, EyeOff } from "lucide-react";
import { useSelector } from "react-redux";
import { applyTagChanges } from "@core/entity_resources/tags";
import { updateEdges } from "@entities/edge/edgeMutations";
import type { Edge, EdgeMovementRule, EdgeVisibilityRule } from "@entities/edge/types";
import type { RootState } from "@store/store";
import { NotesEditor } from "@ui/controls/NotesEditor";
import { EdgeTagEditor } from "@ui/panels/edge_properties/EdgeTagEditor";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

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

/** Edge rules and metadata share the validated, undoable status mutation path. */
export function EdgeStatusPanel() {
  const { readOnly } = usePersistence();
  const commitStatus = useStatusActions();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const edgeIds = selection.selectedEntityType === "edge" ? selection.selectedIds : [];
  const edges = edgeIds.map(id => encounter.edges.byId[id]).filter((edge): edge is Edge => Boolean(edge));
  if (!edges.length) return <p className="text-sm text-canvas-muted">Select an edge to view status.</p>;
  const first = edges[0];
  const visibility = edges.every(edge => edge.visibilityRule === first.visibilityRule) ? first.visibilityRule : undefined;
  const buttonClass = (active: boolean) => `flex h-9 min-w-9 items-center justify-center rounded-full border px-2 enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted"}`;
  function toggleMovement(rule: EdgeMovementRule) {
    const remove = edges.every(edge => edge.movementRules.includes(rule));
    void commitStatus("edge.updateProperties", { edgeIds, properties: { movementRule: rule, operation: remove ? "remove" : "add" } }, state =>
      edgeIds.reduce((next, id) => {
        const edge = next.edges.byId[id];
        return !edge ? next : updateEdges(next, [id], {
          movementRules: remove ? edge.movementRules.filter(item => item !== rule) : [...new Set([...edge.movementRules, rule])]
        });
      }, state));
  }
  return <div aria-label="Edge status" className="space-y-4 py-2 text-sm">
    <fieldset><legend className="mb-1 font-semibold text-canvas-ink">Movement</legend><div className="flex gap-2">
      {movementOptions.map(({ icon: Icon, label, value }) => {
        const count = edges.filter((edge) => edge.movementRules.includes(value)).length;
        return <TouchTooltip key={value} label={label}><button disabled={readOnly} aria-label={label} aria-pressed={count === edges.length} className={buttonClass(count === edges.length)} data-mixed={count > 0 && count < edges.length || undefined} onClick={() => toggleMovement(value)} title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>;
      })}
    </div></fieldset>
    <fieldset><legend className="mb-1 font-semibold text-canvas-ink">Visibility</legend><div className="flex gap-2">
      {visibilityOptions.map(({ icon: Icon, label, value }) => <TouchTooltip key={value} label={label}><button disabled={readOnly} aria-checked={visibility === value} aria-label={label} className={buttonClass(visibility === value)} onClick={() => void commitStatus("edge.updateProperties", { edgeIds, properties: { visibilityRule: value } }, (state) => updateEdges(state, edgeIds, { visibilityRule: value }))} role="radio" title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>)}
    </div></fieldset>
    {edges.length === 1 ? <>
      <EdgeTagEditor key={`tags:${first.id}`} disabled={readOnly}
        onChange={(interactionTags) => void commitStatus("edge.updateProperties", { edgeIds: [first.id], properties: { interactionTags } }, (state) => {
          const edge = state.edges.byId[first.id];
          if (!edge) return state;
          const tags = applyTagChanges(edge.interactionTags, first.interactionTags, interactionTags);
          return tags === edge.interactionTags ? state : updateEdges(state, [edge.id], { interactionTags: tags });
        })}
        tags={first.interactionTags}
      />
      <NotesEditor key={`notes:${first.id}`} disabled={readOnly} notes={first.notes}
        onChange={(notes) => void commitStatus("edge.updateProperties", { edgeIds: [first.id], properties: { notes } }, (state) => { const edge = state.edges.byId[first.id]; return !edge || (edge.notes ?? "") === notes ? state : updateEdges(state, [first.id], { notes }); })} />
    </> : <p className="text-canvas-muted">Select one edge to edit tags and notes.</p>}
  </div>;
}
