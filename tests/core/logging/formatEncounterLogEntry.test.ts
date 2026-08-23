import { describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import {
  createValidationBlockLogEntry,
  formatCommittedEncounterAction
} from "@core/logging/formatEncounterLogEntry";
import type { Actor } from "@entities/actor/types";
import type { Zone } from "@entities/zone/types";

function zone(id: string, name: string): Zone {
  return {
    autoResize: false,
    colorBorder: "#000000",
    colorFill: "#ffffff",
    id,
    layoutOrientation: "LEFT_RIGHT",
    layoutStrategy: "FLEX",
    name,
    namePosition: "top-left",
    opacity: 1,
    polygon: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ],
    showBorder: true,
    showName: true,
    showSectionDividers: false,
    shape: "polygon",
    tags: []
  };
}

function actor(id: string, name: string, currentZoneId: string): Actor {
  return {
    actorType: "creature",
    currentZoneId,
    id,
    layoutGroup: "neutral",
    metadata: {},
    name,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

function encounter(actorZoneId = "zone-origin"): EncounterState {
  const result = createEncounterState({ id: "logging", name: "Logging" });
  const zones = [zone("zone-origin", "Courtyard"), zone("zone-target", "Great Hall")];
  const actors = [
    actor("actor-goblin", "Goblin", actorZoneId),
    actor("actor-wizard", "Wizard", actorZoneId)
  ];
  return {
    ...result,
    actors: {
      allIds: actors.map(({ id }) => id),
      byId: Object.fromEntries(actors.map((item) => [item.id, item]))
    },
    zones: {
      allIds: zones.map(({ id }) => id),
      byId: Object.fromEntries(zones.map((item) => [item.id, item]))
    }
  };
}

describe("encounter log message formatting", () => {
  it("formats named multi-actor movement with the destination zone", () => {
    const before = encounter();
    const after = encounter("zone-target");
    const action = createEncounterActionRecord("actor.moveMany", {
      actorIds: ["actor-goblin", "actor-wizard"],
      destinationZoneId: "zone-target"
    });

    expect(formatCommittedEncounterAction(action, { before, after })).toBe(
      "Goblin and Wizard moved to the Great Hall."
    );
  });

  it("infers a quick actor drop destination from the committed snapshot", () => {
    const before = encounter();
    const after = encounter("zone-target");
    const action = createEncounterActionRecord("actor.moveMany", {
      actorIds: ["actor-goblin", "actor-wizard"]
    });

    expect(formatCommittedEncounterAction(action, { before, after })).toBe(
      "Goblin and Wizard moved to the Great Hall."
    );
  });

  it("uses the zoneId variant emitted by zone paint", () => {
    const before = encounter();
    const action = createEncounterActionRecord("zone.paintColors", {
      zoneId: "zone-target"
    });

    expect(
      formatCommittedEncounterAction(action, { before, after: before })
    ).toBe("Painted Great Hall.");
  });

  it("has a purpose-built message for every currently emitted action type", () => {
    const current = encounter();
    const cases: [string, JsonObject][] = [
      ["actor.create", { actorId: "actor-goblin", destinationZoneId: "zone-target" }],
      ["actor.move", { actorIds: ["actor-goblin"], destinationZoneId: "zone-target" }],
      ["actor.moveMany", { actorIds: ["actor-goblin", "actor-wizard"], destinationZoneId: "zone-target" }],
      ["actor.delete", { actorIds: ["actor-goblin"] }],
      ["actor.duplicate", { actorId: "actor-goblin", duplicateActorId: "actor-wizard" }],
      ["actor.renameMany", { actorIds: ["actor-goblin"], name: "Scout" }],
      ["actor.paint", { actorIds: ["actor-goblin"], properties: { size: "small" } }],
      ["actor.updateProperties", { actorId: "actor-goblin", properties: { size: "small" } }],
      ["zone.create", { zoneId: "zone-target" }],
      ["zone.delete", { zoneId: "zone-target" }],
      ["zone.move", { zoneId: "zone-target" }],
      ["zone.reshape", { zoneId: "zone-target" }],
      ["zone.updateProperties", { zoneId: "zone-target", properties: { name: "Hall" } }],
      ["zone.paintColors", { zoneId: "zone-target" }],
      ["zone.exportProperties", { targetZoneIds: ["zone-target"] }],
      ["engagement.create", { actorIds: ["actor-goblin", "actor-wizard"] }],
      ["engagement.join", { actorIds: ["actor-goblin", "actor-wizard"] }],
      ["engagement.merge", { actorIds: ["actor-goblin", "actor-wizard"] }],
      ["engagement.leaveSelected", { actorIds: ["actor-goblin"] }],
      ["engagement.moveZone", { actorIds: ["actor-goblin", "actor-wizard"], destinationZoneId: "zone-target" }],
      ["engagement.groupSelected", { actorIds: ["actor-goblin", "actor-wizard"] }],
      ["engagement.update", { participantIds: ["actor-goblin", "actor-wizard"], properties: { layoutStrategy: "SEQUENTIAL" } }],
      ["initiative.addActors", { actorIds: ["actor-goblin", "actor-wizard"] }],
      ["initiative.removeActor", { actorId: "actor-goblin" }],
      ["initiative.removeActors", { actorIds: ["actor-goblin", "actor-wizard"] }],
      ["initiative.clear", { actorIds: ["actor-goblin", "actor-wizard"] }],
      ["initiative.updateValue", { actorId: "actor-goblin", initiative: 12 }],
      ["initiative.reorder", { actorId: "actor-goblin", actorIds: ["actor-goblin", "actor-wizard"] }],
      ["initiative.start", {}],
      ["initiative.setCurrent", { actorId: "actor-goblin" }],
      ["initiative.end", { actorId: "actor-goblin", round: 1 }],
      ["initiative.next", { actorId: "actor-goblin", round: 1 }],
      ["initiative.previous", { actorId: "actor-wizard", round: 1 }],
      ["background.add", { backgroundImage: { name: "Map" } }],
      ["background.replace", { backgroundImage: { name: "Map" } }],
      ["background.delete", { backgroundImageName: "Map" }]
    ];

    for (const [type, payload] of cases) {
      const action = createEncounterActionRecord(type, payload);
      expect(
        formatCommittedEncounterAction(action, {
          before: current,
          after: current
        })
      ).not.toBe(`${type} committed.`);
    }
  });

  it("includes rename and engagement property details", () => {
    const before = encounter();
    const renamedActors = encounter();
    renamedActors.actors.byId["actor-goblin"] = {
      ...renamedActors.actors.byId["actor-goblin"],
      name: "Scout"
    };
    const rename = createEncounterActionRecord("actor.renameMany", {
      actorIds: ["actor-goblin"],
      name: "Scout"
    });
    expect(
      formatCommittedEncounterAction(rename, {
        before,
        after: renamedActors
      })
    ).toBe("Goblin renamed to Scout.");

    const update = createEncounterActionRecord("engagement.update", {
      participantIds: ["actor-goblin", "actor-wizard"],
      properties: { layoutStrategy: "SEQUENTIAL" }
    });
    expect(
      formatCommittedEncounterAction(update, { before, after: before })
    ).toBe(
      "Updated the engagement for Goblin and Wizard: layoutStrategy."
    );
  });

  it("includes the changed initiative value or states that it was cleared", () => {
    const current = encounter();
    const setValue = createEncounterActionRecord("initiative.updateValue", {
      actorId: "actor-goblin",
      initiative: 17
    });
    const clearValue = createEncounterActionRecord("initiative.updateValue", {
      actorId: "actor-goblin",
      initiative: null
    });

    expect(
      formatCommittedEncounterAction(setValue, { before: current, after: current })
    ).toBe("Set Goblin's initiative to 17.");
    expect(
      formatCommittedEncounterAction(clearValue, { before: current, after: current })
    ).toBe("Cleared Goblin's initiative.");
  });

  it("does not use an Unknown placeholder for a pre-guarded zone creation", () => {
    const current = encounter();
    const action = createEncounterActionRecord("zone.create", {
      polygon: []
    });
    expect(
      formatCommittedEncounterAction(action, { before: current, after: current })
    ).toBe("Zone creation requested.");
  });

  it("categorizes a rejected attempt as validation and includes its reason", () => {
    const current = encounter();
    const action = {
      ...createEncounterActionRecord("actor.move", {
        actorIds: ["actor-goblin"],
        destinationZoneId: "zone-target"
      }),
      validationResult: {
        blocked: true,
        messages: [
          {
            code: "movement.blocked",
            message: "The route is blocked.",
            severity: "error" as const
          }
        ],
        valid: false
      }
    };

    expect(createValidationBlockLogEntry(action, current)).toEqual(
      expect.objectContaining({
        category: "validation",
        kind: "validation-block",
        message:
          "Blocked action: Goblin moved to the Great Hall. The route is blocked."
      })
    );
  });
});
