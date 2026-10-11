import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { getActorRadius, toNestingActor } from '@core/layout/actorFootprints';
import { distanceToPolygonBoundary, isPointInPolygon, getFootprint, isFootprintInsideZone } from '@core/layout/polygonGeometry';
import { packPolygonActors } from '@core/layout/nesting_ts';
import { getEngagementAwareSplitInput } from '@core/layout/engagementSplitLayout';
import { orderActorsForEngagementPacking } from '@core/layout/engagementPackingOrder';
import { footprintFitsPolygon, getEngagementParticipantCandidateLayouts } from '@core/layout/engagementPackingCandidates';
import { getEngagementTokenCandidates } from '@core/layout/engagementTokenPlacement';
import { engagementFootprintsAreSeparate } from '@core/layout/engagementFootprintGeometry';
import { ENGAGEMENT_TOKEN_RADIUS, ENGAGEMENT_MINIMUM_CLEARANCE, ENGAGEMENT_PREFERRED_CLEARANCE } from '@core/layout/engagementGeometryConstants';
import { assignGridCells } from './gridCellPacking';
import { actorAnchorCells, anchorKey, canvasAnchors, pointDistance, pointOrder } from './gridTopology';
import { footprintFits } from './gridGeometry';
import { polygonCentroid } from './zoneMembership';
import type { Actor } from '@entities/actor/types';

export type GridPlacement = { actorId: string; point: LayoutPoint; radius: number; sectionPolygon?: LayoutPoint[]; engagementTokenPoint?: LayoutPoint };

export function actorFitsPolygon(actor: Actor, point: LayoutPoint, polygon: LayoutPoint[]) {
  if (actor.shape === 'rectangle') return isFootprintInsideZone(getFootprint(toNestingActor(actor), point, 0, 48), polygon);
  return isPointInPolygon(point, polygon) && distanceToPolygonBoundary(point, polygon) >= getActorRadius(actor) - 1e-6;
}

/** Discrete packing reserves every anchor cell; artwork may still intersect beyond those cells. */
export function packGridZone(state: EncounterState, zoneId: string): { fits: boolean; placements: GridPlacement[] } {
  const zone = state.zones.byId[zoneId];
  if (!zone) return { fits: false, placements: [] };
  const actors = orderActorsForEngagementPacking(state, state.actors.allIds.map(id => state.actors.byId[id]).filter(actor => actor.currentZoneId === zoneId));
  if (!actors.length) return { fits: true, placements: [] };
  const split = zone.layoutStrategy.startsWith('SPLIT') ? getEngagementAwareSplitInput(state, zoneId) : undefined;
  // A small planning footprint obtains layout goals and section partitions. Real token
  // containment is checked below; it must not impose continuous-layout clearance.
  const layout = packPolygonActors({ actors: (split?.actors ?? actors.map(toNestingActor)).map(actor => ({ ...actor, radius: Math.min(actor.radius, 12) })),
    layoutStrategy: zone.layoutStrategy, layoutOrientation: zone.layoutOrientation, polygon: zone.polygon, splitSectionOrder: split?.splitSectionOrder });
  const sections = new Map(layout.splitSections?.map(section => [section.id, section.polygon]));
  const sectionIds = new Map(split?.actors.map(actor => [actor.id, actor.splitSectionId]));
  const goals = new Map(Object.entries(layout.placements));
  for (const id of state.engagements.allIds) {
    const engagement = state.engagements.byId[id];
    if (engagement.parentZoneId !== zoneId) continue;
    const members = engagement.participantIds.flatMap(id => state.actors.byId[id]?.currentZoneId === zoneId ? [state.actors.byId[id]] : []);
    if (!members.length) continue;
    const section = sections.get(`engagement-${id}`) ?? zone.polygon;
    const baseline = members.flatMap(actor => goals.has(actor.id) ? [goals.get(actor.id)!] : []);
    const center = baseline.length ? { x: baseline.reduce((sum, p) => sum + p.x, 0) / baseline.length, y: baseline.reduce((sum, p) => sum + p.y, 0) / baseline.length } : polygonCentroid(section);
    const targets = getEngagementParticipantCandidateLayouts(center, members.map(getActorRadius), engagement.layoutOrientation, engagement.layoutStrategy, ENGAGEMENT_PREFERRED_CLEARANCE, ENGAGEMENT_TOKEN_RADIUS)[0];
    members.forEach((actor, i) => goals.set(actor.id, targets[i]));
  }
  const anchorsBySize = new Map<string, LayoutPoint[]>();
  const candidates = actors.map(actor => {
    const section = sections.get(sectionIds.get(actor.id) ?? '');
    let anchors = anchorsBySize.get(actor.size);
    if (!anchors) { anchors = canvasAnchors(state, actor.size); anchorsBySize.set(actor.size, anchors); }
    const goal = goals.get(actor.id) ?? polygonCentroid(section ?? zone.polygon);
    return anchors.filter(point => footprintFits(point, getActorRadius(actor), state.canvasSize) && actorFitsPolygon(actor, point, section ?? zone.polygon))
      .sort((a, b) => pointDistance(a, goal) - pointDistance(b, goal) || pointOrder(a, b));
  });
  const cellKeysBySize = new Map<string, Map<string, string[]>>();
  const cellCandidates = candidates.map((points, index) => {
    const size = actors[index].size;
    if (!cellKeysBySize.has(size)) cellKeysBySize.set(size, new Map());
    const cache = cellKeysBySize.get(size)!;
    return points.map(point => {
      const key = anchorKey(point);
      let cells = cache.get(key);
      if (!cells) { cells = actorAnchorCells(state, point, size).map(cell => anchorKey(cell.center)); cache.set(key, cells); }
      return { point, cells };
    });
  });
  const positions = assignGridCells(cellCandidates);
  if (!positions) return { fits: false, placements: [] };
  const placements = actors.map((actor, index) => ({ actorId: actor.id, point: positions.get(index)!, radius: getActorRadius(actor),
    ...(sections.get(sectionIds.get(actor.id) ?? '') ? { sectionPolygon: sections.get(sectionIds.get(actor.id) ?? '') } : {}) }));
  const attached = attachFixedEngagementTokens(state, placements);
  const fits = state.engagements.allIds.every(id => state.engagements.byId[id].parentZoneId !== zoneId ||
    state.engagements.byId[id].participantIds.every(actorId => attached.some(p => p.actorId === actorId && p.engagementTokenPoint)));
  return { fits, placements: fits ? attached : [] };
}

/** Engagement visuals follow accepted points without repacking authoritative anchors. */
export function attachFixedEngagementTokens(state: EncounterState, placements: GridPlacement[]): GridPlacement[] {
  const byId = new Map(placements.map(placement => [placement.actorId, placement]));
  const tokens = new Map<string, LayoutPoint>();
  const acceptedTokens: { point: LayoutPoint; radius: number }[] = [];
  for (const id of state.engagements.allIds) {
    const engagement = state.engagements.byId[id];
    const members = engagement.participantIds.flatMap(actorId => byId.has(actorId) ? [byId.get(actorId)!] : []);
    if (!members.length) continue;
    let token: LayoutPoint | undefined = { x: members.reduce((sum, member) => sum + member.point.x, 0) / members.length, y: members.reduce((sum, member) => sum + member.point.y, 0) / members.length };
    if (state.movementRules.zoneLocked) {
      const polygon = members[0].sectionPolygon ?? state.zones.byId[engagement.parentZoneId]?.polygon;
      const participants = members.map(member => ({ ...member, shape: state.actors.byId[member.actorId].shape }));
      const obstacles = placements.filter(member => state.actors.byId[member.actorId].currentZoneId === engagement.parentZoneId).map(member => ({ ...member, shape: state.actors.byId[member.actorId].shape }));
      token = polygon ? getEngagementTokenCandidates(participants, polygon).find(point =>
        footprintFitsPolygon(point, ENGAGEMENT_TOKEN_RADIUS, polygon, ENGAGEMENT_MINIMUM_CLEARANCE) &&
        [...obstacles, ...acceptedTokens].every(obstacle => engagementFootprintsAreSeparate({ point, radius: ENGAGEMENT_TOKEN_RADIUS }, obstacle, ENGAGEMENT_MINIMUM_CLEARANCE))) : undefined;
    }
    if (!token) continue;
    acceptedTokens.push({ point: token, radius: ENGAGEMENT_TOKEN_RADIUS });
    for (const member of members) tokens.set(member.actorId, token);
  }
  return placements.map(placement => ({ ...placement, ...(tokens.has(placement.actorId) ? { engagementTokenPoint: tokens.get(placement.actorId)! } : {}) }));
}
