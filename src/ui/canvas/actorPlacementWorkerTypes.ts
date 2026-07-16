import type { EncounterState } from '@core/encounter/types';
import type { LayoutComputationStrategy } from '@core/layout/types';
import type { PolygonNestingSettings } from '@core/layout/nesting_ts';
import type { ActorPlacementGeometry } from './actorPlacementCache';

export type ActorPlacementWorkerRequest = {
  type: 'calculate';
  requestId: number;
  encounter: EncounterState;
  nestingSettings: PolygonNestingSettings;
  computationStrategy: LayoutComputationStrategy;
  authoritativeZoneIds: string[];
  knownGeometry: ActorPlacementGeometry[];
};

export type ActorPlacementWorkerResponse = {
  type: 'calculated';
  phase: 'geometry' | 'proactive';
  requestId: number;
  cacheKey: string;
  geometry: ActorPlacementGeometry[];
  proactivePlans: Record<string, ActorPlacementGeometry[]>;
  proactiveAcceleration?: 'WEBGPU' | 'CPU';
};
