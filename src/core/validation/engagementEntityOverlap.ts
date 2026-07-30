import {
  engagementFootprintsAreSeparate,
  type EngagementFootprint
} from '@core/layout/engagementFootprintGeometry';
import { ENGAGEMENT_MINIMUM_CLEARANCE } from '@core/layout/engagementGeometryConstants';
import type { LayoutPoint } from '@core/layout/types';

type IdentifiedFootprint = EngagementFootprint & {
  actorId: string;
};

/** Final defense-in-depth audit for every settled actor and token area. */
export function engagementEntitiesAreSeparate(
  actors: readonly IdentifiedFootprint[],
  tokens: readonly LayoutPoint[],
  tokenRadius: number
): boolean {
  const actorsAreSeparate = actors.every((actor, index) =>
    actors.slice(index + 1).every((other) =>
      engagementFootprintsAreSeparate(
        actor,
        other,
        ENGAGEMENT_MINIMUM_CLEARANCE
      )
    )
  );
  const tokensAreSeparate = tokens.every((token, index) => {
    const footprint = { point: token, radius: tokenRadius };
    return actors.every((actor) =>
      engagementFootprintsAreSeparate(
        footprint,
        actor,
        ENGAGEMENT_MINIMUM_CLEARANCE
      )
    ) && tokens.slice(index + 1).every((other) =>
      engagementFootprintsAreSeparate(
        footprint,
        { point: other, radius: tokenRadius },
        ENGAGEMENT_MINIMUM_CLEARANCE
      )
    );
  });

  return actorsAreSeparate && tokensAreSeparate;
}
