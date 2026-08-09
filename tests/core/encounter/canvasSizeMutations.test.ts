import { resizeEncounterCanvas } from "@core/encounter/canvasSizeMutations";
import { createEncounterState } from "@core/encounter/createEncounterState";
import type { Zone } from "@entities/zone/types";
import type { Actor } from "@entities/actor/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { clampCanvasResizeToValidLayout } from "@ui/toolbar/background/backgroundCanvasActions";

const zone: Zone = {
  colorBorder: "#166534",
  colorFill: "#dcfce7",
  id: "zone-1",
  layoutOrientation: "LEFT_RIGHT",
  layoutStrategy: "FLEX",
  name: "Zone",
  namePosition: "top-left",
  opacity: 0.5,
  polygon: [
    { x: 100, y: 80 },
    { x: 300, y: 80 },
    { x: 300, y: 240 },
    { x: 100, y: 240 }
  ],
  shape: "rectangle",
  showBorder: true,
  showName: true,
  tags: []
};

describe("canvas size mutations", () => {
  it("scales zones from the top-left while leaving derived entities untouched", () => {
    const encounter = {
      ...createEncounterState({ id: "resize", name: "Resize" }),
      zones: { allIds: [zone.id], byId: { [zone.id]: zone } }
    };
    const resized = resizeEncounterCanvas(encounter, {
      canvasSize: { height: 320, width: 480 },
      zoneScale: 0.5
    });

    expect(resized.canvasSize).toEqual({ height: 320, width: 480 });
    expect(resized.zones.byId[zone.id]?.polygon).toEqual([
      { x: 50, y: 40 },
      { x: 150, y: 40 },
      { x: 150, y: 120 },
      { x: 50, y: 120 }
    ]);
    expect(resized.actors).toBe(encounter.actors);
    expect(resized.engagements).toBe(encounter.engagements);
    expect(resized.edges).toBe(encounter.edges);
    expect(encounter.zones.byId[zone.id]?.polygon).toEqual(zone.polygon);
  });

  it("allows advisory reporting while strict mode blocks an invalid requested scale", () => {
    const actor: Actor = {
      actorType: "creature",
      currentZoneId: zone.id,
      id: "actor-1",
      layoutGroup: "hero",
      metadata: {},
      name: "Actor",
      shape: "circle",
      size: "medium",
      statusEffects: []
    };
    const advisory = {
      ...createEncounterState({ id: "validation", name: "Validation" }),
      actors: { allIds: [actor.id], byId: { [actor.id]: actor } },
      zones: { allIds: [zone.id], byId: { [zone.id]: zone } }
    };
    const candidate = resizeEncounterCanvas(advisory, {
      canvasSize: { height: 128, width: 192 },
      zoneScale: 0.2
    });
    const action = createEncounterActionRecord("canvas.resize");

    expect(
      prepareValidatedEncounterChange({
        action,
        currentEncounter: advisory,
        nextEncounter: candidate
      })
    ).toMatchObject({ blocked: false, validationResult: { valid: false } });

    const strict = {
      ...advisory,
      validationState: { ...advisory.validationState, mode: "STRICT" as const }
    };
    expect(
      prepareValidatedEncounterChange({
        action,
        currentEncounter: strict,
        nextEncounter: { ...candidate, validationState: strict.validationState }
      })
    ).toMatchObject({ blocked: true, validationResult: { valid: false } });
  });

  it("clamps shrinking to the nearest larger actor-safe scale", () => {
    const actor: Actor = {
      actorType: "creature",
      currentZoneId: zone.id,
      id: "actor-1",
      layoutGroup: "hero",
      metadata: {},
      name: "Actor",
      shape: "circle",
      size: "medium",
      statusEffects: []
    };
    const encounter = {
      ...createEncounterState({ id: "clamp", name: "Clamp" }),
      actors: { allIds: [actor.id], byId: { [actor.id]: actor } },
      zones: { allIds: [zone.id], byId: { [zone.id]: zone } }
    };
    const clamped = clampCanvasResizeToValidLayout(
      encounter,
      encounter,
      { height: 128, width: 192 },
      0.2,
      "canvas.resize"
    );

    expect(clamped.canvasSize.width).toBeGreaterThan(192);
    expect(clamped.canvasSize.height).toBeGreaterThan(128);
    expect(clamped.canvasSize.width / clamped.canvasSize.height).toBeCloseTo(1.5, 1);
    expect(
      prepareValidatedEncounterChange({
        action: createEncounterActionRecord("canvas.resize"),
        currentEncounter: encounter,
        nextEncounter: clamped.encounter
      }).validationResult.valid
    ).toBe(true);
  });
});
