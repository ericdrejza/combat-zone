import { describe, expect, it } from "vitest";

import type { Actor } from "../../entities/actor/types";
import type { Engagement } from "../../entities/engagement/types";
import type { Zone } from "../../entities/zone/types";
import { createEncounterState } from "../encounter/createEncounterState";
import type { EncounterState } from "../encounter/types";
import type { EntityCollection } from "../state/entityCollection";
import {
  calculateEngagementLayout,
  calculateZoneLayout
} from "./encounterLayout";
import { getLayoutStrategy } from "./strategies";

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

const battlefieldZone: Zone = {
  colorBorder: "#9b876b",
  colorFill: "#ffffff",
  id: "zone-battlefield",
  name: "Battlefield",
  namePosition: "top-left",
  opacity: 0.7,
  polygon: [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 120 },
    { x: 0, y: 120 }
  ],
  showBorder: true,
  showName: false,
  shape: "rectangle",
  layoutStrategy: "SPLIT_SEQUENTIAL",
  layoutOrientation: "LEFT_RIGHT",
  tags: []
};

const heroActor: Actor = {
  id: "actor-hero",
  name: "Hero",
  actorType: "creature",
  layoutGroup: "hero",
  currentZoneId: "zone-battlefield",
  statusEffects: [],
  metadata: {}
};

const secondHeroActor: Actor = {
  id: "actor-second-hero",
  name: "Second Hero",
  actorType: "creature",
  layoutGroup: "hero",
  currentZoneId: "zone-battlefield",
  statusEffects: [],
  metadata: {}
};

const enemyActor: Actor = {
  id: "actor-enemy",
  name: "Enemy",
  actorType: "creature",
  layoutGroup: "enemy",
  currentZoneId: "zone-battlefield",
  statusEffects: [],
  metadata: {}
};

const objectiveActor: Actor = {
  id: "actor-objective",
  name: "Objective",
  actorType: "objective",
  layoutGroup: "neutral",
  currentZoneId: "zone-battlefield",
  statusEffects: [],
  metadata: {}
};

const engagement: Engagement = {
  id: "engagement-melee",
  participantIds: ["actor-hero", "actor-enemy"],
  parentZoneId: "zone-battlefield",
  layoutStrategy: "SEQUENTIAL",
  layoutOrientation: "TOP_BOTTOM"
};

function createLayoutEncounterState(overrides?: {
  zone?: Partial<Zone>;
  actors?: Actor[];
  engagement?: Partial<Engagement>;
}): EncounterState {
  const zone = {
    ...battlefieldZone,
    ...overrides?.zone
  };
  const actors = overrides?.actors ?? [
    heroActor,
    secondHeroActor,
    enemyActor,
    objectiveActor
  ];

  return {
    ...createEncounterState({
      id: "encounter-layout",
      name: "Layout Encounter"
    }),
    zones: collection([zone]),
    actors: collection(actors),
    engagements: collection([
      {
        ...engagement,
        ...overrides?.engagement
      }
    ])
  };
}

describe("layout strategies", () => {
  it("registers shared pluggable strategies", () => {
    expect(getLayoutStrategy("FLEX").id).toBe("FLEX");
    expect(getLayoutStrategy("SEQUENTIAL").id).toBe("SEQUENTIAL");
    expect(getLayoutStrategy("SPLIT_FLEX").id).toBe("SPLIT_FLEX");
    expect(getLayoutStrategy("SPLIT_SEQUENTIAL").id).toBe("SPLIT_SEQUENTIAL");
  });

  it("describes deterministic FLEX layout without calculating actor positions", () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutStrategy: "FLEX"
      },
      actors: [heroActor, enemyActor]
    });
    const firstLayout = calculateZoneLayout(state, "zone-battlefield");
    const secondLayout = calculateZoneLayout(state, "zone-battlefield");

    expect(firstLayout).toEqual(secondLayout);
    expect(firstLayout.descriptor).toEqual({
      strategy: "FLEX",
      orientation: "LEFT_RIGHT",
      className: "cz-layout cz-layout-flex cz-layout-orientation-left-right",
      sections: [
        {
          id: "all",
          className: "cz-layout-section-all",
          items: [
            { id: "actor-hero", layoutGroup: "hero" },
            { id: "actor-enemy", layoutGroup: "enemy" },
            { id: "engagement-melee", layoutGroup: "neutral" }
          ]
        }
      ]
    });
    expect(state.actors.byId["actor-hero"]).not.toHaveProperty("position");
  });

  it("uses allIds collection order for SEQUENTIAL layout items", () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutStrategy: "SEQUENTIAL",
        layoutOrientation: "TOP_BOTTOM"
      },
      actors: [enemyActor, heroActor, objectiveActor]
    });

    expect(calculateZoneLayout(state, "zone-battlefield").descriptor).toEqual({
      strategy: "SEQUENTIAL",
      orientation: "TOP_BOTTOM",
      className: "cz-layout cz-layout-sequential cz-layout-orientation-top-bottom",
      sections: [
        {
          id: "all",
          className: "cz-layout-section-all",
          items: [
            { id: "actor-enemy", layoutGroup: "enemy" },
            { id: "actor-hero", layoutGroup: "hero" },
            { id: "actor-objective", layoutGroup: "neutral" },
            { id: "engagement-melee", layoutGroup: "neutral" }
          ]
        }
      ]
    });
  });

  it("splits heroes, enemies, and neutral actors left-to-right", () => {
    const state = createLayoutEncounterState();

    expect(calculateZoneLayout(state, "zone-battlefield").descriptor).toEqual({
      strategy: "SPLIT_SEQUENTIAL",
      orientation: "LEFT_RIGHT",
      className:
        "cz-layout cz-layout-split-sequential cz-layout-orientation-left-right",
      sections: [
        {
          id: "hero",
          className: "cz-layout-section-hero",
          items: [
            { id: "actor-hero", layoutGroup: "hero" },
            { id: "actor-second-hero", layoutGroup: "hero" }
          ]
        },
        {
          id: "neutral",
          className: "cz-layout-section-neutral",
          items: [
            { id: "actor-objective", layoutGroup: "neutral" },
            { id: "engagement-melee", layoutGroup: "neutral" }
          ]
        },
        {
          id: "enemy",
          className: "cz-layout-section-enemy",
          items: [{ id: "actor-enemy", layoutGroup: "enemy" }]
        }
      ]
    });
  });

  it("supports split flex grouping with flex-specific strategy metadata", () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutStrategy: "SPLIT_FLEX"
      }
    });

    expect(calculateZoneLayout(state, "zone-battlefield").descriptor).toEqual({
      strategy: "SPLIT_FLEX",
      orientation: "LEFT_RIGHT",
      className: "cz-layout cz-layout-split-flex cz-layout-orientation-left-right",
      sections: [
        {
          id: "hero",
          className: "cz-layout-section-hero",
          items: [
            { id: "actor-hero", layoutGroup: "hero" },
            { id: "actor-second-hero", layoutGroup: "hero" }
          ]
        },
        {
          id: "neutral",
          className: "cz-layout-section-neutral",
          items: [
            { id: "actor-objective", layoutGroup: "neutral" },
            { id: "engagement-melee", layoutGroup: "neutral" }
          ]
        },
        {
          id: "enemy",
          className: "cz-layout-section-enemy",
          items: [{ id: "actor-enemy", layoutGroup: "enemy" }]
        }
      ]
    });
  });

  it("splits heroes, enemies, and neutral actors top-to-bottom", () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutOrientation: "TOP_BOTTOM"
      }
    });

    expect(calculateZoneLayout(state, "zone-battlefield").descriptor).toMatchObject({
      strategy: "SPLIT_SEQUENTIAL",
      orientation: "TOP_BOTTOM",
      className:
        "cz-layout cz-layout-split-sequential cz-layout-orientation-top-bottom"
    });
  });

  it("calculates engagement participant layout from participant membership and actor collection order", () => {
    const state = createLayoutEncounterState({
      actors: [enemyActor, objectiveActor, heroActor]
    });

    expect(calculateEngagementLayout(state, "engagement-melee").descriptor).toEqual({
      strategy: "SEQUENTIAL",
      orientation: "TOP_BOTTOM",
      className: "cz-layout cz-layout-sequential cz-layout-orientation-top-bottom",
      sections: [
        {
          id: "all",
          className: "cz-layout-section-all",
          items: [
            { id: "actor-enemy", layoutGroup: "enemy" },
            { id: "actor-hero", layoutGroup: "hero" }
          ]
        }
      ]
    });
  });
});
