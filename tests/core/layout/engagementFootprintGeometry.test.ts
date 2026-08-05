import { describe, expect, it } from 'vitest';

import {
  engagementFootprintsAreSeparate,
  engagementSegmentClearsFootprint
} from '@core/layout/engagementFootprintGeometry';
import { ENGAGEMENT_MINIMUM_CLEARANCE } from '@core/layout/engagementGeometryConstants';

describe('engagement footprint geometry', () => {
  it('rejects diagonal rectangle overlap that center-radius checks miss', () => {
    const first = {
      point: { x: 50, y: 50 },
      radius: 30,
      shape: 'rectangle' as const
    };

    expect(engagementFootprintsAreSeparate(
      first,
      {
        point: { x: 100, y: 100 },
        radius: 30,
        shape: 'rectangle'
      },
      ENGAGEMENT_MINIMUM_CLEARANCE
    )).toBe(false);
    expect(engagementFootprintsAreSeparate(
      first,
      {
        point: {
          x: 50 + 30 * 2 + ENGAGEMENT_MINIMUM_CLEARANCE,
          y: 100
        },
        radius: 30,
        shape: 'rectangle'
      },
      ENGAGEMENT_MINIMUM_CLEARANCE
    )).toBe(true);
  });

  it('accepts and rejects circle-to-rectangle token clearance exactly', () => {
    const rectangle = {
      point: { x: 50, y: 50 },
      radius: 20,
      shape: 'rectangle' as const
    };

    expect(engagementFootprintsAreSeparate(
      { point: { x: 75, y: 75 }, radius: 12 },
      rectangle,
      ENGAGEMENT_MINIMUM_CLEARANCE
    )).toBe(false);
    expect(engagementFootprintsAreSeparate(
      {
        point: {
          x: 50 + 20 + ENGAGEMENT_MINIMUM_CLEARANCE * 3,
          y: 50 + 20 + ENGAGEMENT_MINIMUM_CLEARANCE * 3
        },
        radius: 12
      },
      rectangle,
      ENGAGEMENT_MINIMUM_CLEARANCE
    )).toBe(true);
  });

  it('treats rectangular corners as connector obstacles', () => {
    const rectangle = {
      point: { x: 50, y: 50 },
      radius: 20,
      shape: 'rectangle' as const
    };

    expect(engagementSegmentClearsFootprint(
      { x: 0, y: 60 },
      { x: 60, y: 0 },
      rectangle,
      ENGAGEMENT_MINIMUM_CLEARANCE
    )).toBe(false);
    expect(engagementSegmentClearsFootprint(
      { x: 0, y: 20 },
      { x: 20, y: 0 },
      rectangle,
      ENGAGEMENT_MINIMUM_CLEARANCE
    )).toBe(true);
  });
});
