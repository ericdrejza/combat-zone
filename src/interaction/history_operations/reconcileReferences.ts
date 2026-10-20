import type { EncounterState } from '@core/encounter/types';
import type { InteractionState } from '@interaction/interactionState';
import type { SelectableEntityType } from '@interaction/selection/types';

/** Never restore session selection from history, or leave references to removed entities. */
export function reconcileReferences(state: InteractionState, encounter: EncounterState): void {
  const collections = {
    actor: encounter.actors, zone: encounter.zones, edge: encounter.edges,
    engagement: encounter.engagements, annotation: encounter.annotations
  };
  const exists = (type: SelectableEntityType, id: string) => Boolean(collections[type].byId[id]);
  if (state.editingRuler && !encounter.rulers.byId[state.editingRuler.id]) state.editingRuler = null;
  const selection = state.selection;
  selection.selectedIds = selection.selectedEntityType
    ? selection.selectedIds.filter((id) => exists(selection.selectedEntityType!, id)) : [];
  if (!selection.selectedIds.length) selection.selectedEntityType = null;
  selection.overlayTargets = selection.overlayTargets.filter(({ entityType, id }) => exists(entityType, id));
  if (state.contextualActionRequest && !exists(state.contextualActionRequest.entityType, state.contextualActionRequest.entityId)) state.contextualActionRequest = null;
  if (state.actorTool.targetZoneId && !encounter.zones.byId[state.actorTool.targetZoneId]) state.actorTool.targetZoneId = null;
  if (state.actorTool.clipboardActorId && !encounter.actors.byId[state.actorTool.clipboardActorId]) state.actorTool.clipboardActorId = null;
}
