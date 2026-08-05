import type { ActorShape } from '@entities/actor/types';
import type { LayoutPoint } from './types';

export type EngagementPackedActor = {
  actorId: string;
  point: LayoutPoint;
  radius: number;
  sectionPolygon?: LayoutPoint[];
  shape?: ActorShape;
};

export type EngagementParticipantPoint = {
  actorId: string;
  point: LayoutPoint;
  radius: number;
  shape?: ActorShape;
};

export type EngagementPackingResult = {
  failureReason?: 'connectors' | 'space';
  fits: boolean;
  placements: EngagementPackedActor[];
  tokenPoints: Readonly<Record<string, LayoutPoint>>;
};
