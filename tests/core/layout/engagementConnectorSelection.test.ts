import { describe, expect, it } from 'vitest';

import { chooseEngagementConnector } from '@core/layout/engagementConnectorSelection';
import { ENGAGEMENT_BRANCH_TO_DIRECT_LENGTH_RATIO } from '@core/layout/engagementGeometryConstants';

const token = { x: 0, y: 0 };
const participant = { actorId: 'target', point: { x: 100, y: 0 } };
const parent = { actorId: 'parent', point: { x: 50, y: 20 } };
const direct = [{ distance: 100, participant, pendingIndex: 0 }];

function branchAtRatio(ratio: number) {
  return [
    {
      distance: direct[0].distance * ratio,
      parent,
      participant,
      pendingIndex: 0
    }
  ];
}

describe('engagement connector selection', () => {
  it.each([
    ENGAGEMENT_BRANCH_TO_DIRECT_LENGTH_RATIO - 0.01,
    ENGAGEMENT_BRANCH_TO_DIRECT_LENGTH_RATIO
  ])('uses an actor branch at or below the ratio threshold', (ratio) => {
    const choice = chooseEngagementConnector(
      token,
      direct,
      branchAtRatio(ratio)
    );

    expect(choice?.viaActorId).toBe(parent.actorId);
  });

  it('uses the token spoke when greater than the ratio threshold', () => {
    const choice = chooseEngagementConnector(
      token,
      direct,
      branchAtRatio(ENGAGEMENT_BRANCH_TO_DIRECT_LENGTH_RATIO + 0.01)
    );

    expect(choice).toEqual({ ...direct[0], from: token });
  });

  it('uses whichever connector approach has a valid candidate', () => {
    expect(chooseEngagementConnector(token, direct, [])).toEqual({
      ...direct[0],
      from: token
    });
    expect(
      chooseEngagementConnector(
        token,
        [],
        branchAtRatio(ENGAGEMENT_BRANCH_TO_DIRECT_LENGTH_RATIO)
      )?.viaActorId
    ).toBe(parent.actorId);
  });
});
