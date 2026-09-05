import { act } from "@testing-library/react";
import { vi } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { ZONELESS_ACTOR_ZONE_ID, type EncounterBackgroundImage } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { EntityCollection } from "@core/state/entityCollection";
import type { Actor } from "@entities/actor/types";
import type { Zone } from "@entities/zone/types";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { createRectanglePolygon } from "@ui/canvas/zones/zoneGeometry";

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

export function actor(
  id: string,
  name: string,
  layoutGroup: Actor["layoutGroup"] = "hero"
): Actor {
  return {
    actorType: "creature",
    currentZoneId: ZONELESS_ACTOR_ZONE_ID,
    id,
    layoutGroup,
    metadata: {},
    name,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

export function zone(): Zone {
  return {
    colorBorder: "#166534",
    colorFill: "#dcfce7",
    id: "zone-target",
    layoutOrientation: "LEFT_RIGHT",
    layoutStrategy: "FLEX",
    name: "Target",
    namePosition: "top-left",
    opacity: 0.45,
    polygon: createRectanglePolygon({ x: 80, y: 80 }, { x: 240, y: 240 }),
    shape: "rectangle",
    showBorder: true,
    showName: true,
    tags: []
  };
}

export function seedEncounter(
  actors: Actor[],
  zones: Zone[] = [],
  backgroundImage: EncounterBackgroundImage | null = null
) {
  store.dispatch(
    commitEncounterChange({
      action: createEncounterActionRecord("test.seed"),
      nextEncounter: {
        ...createEncounterState({
          id: "encounter-zoneless-panel",
          name: "Zoneless Panel"
        }),
        actors: collection(actors),
        backgroundImage,
        zones: collection(zones)
      }
    })
  );
}

export function mockBackgroundImageLuminance(pixel: [number, number, number]) {
  class MockImage extends EventTarget {
    naturalHeight = 1;
    naturalWidth = 1;
    crossOrigin = "";

    set src(_value: string) {
      queueMicrotask(() => this.dispatchEvent(new Event("load")));
    }
  }

  vi.stubGlobal("Image", MockImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: [...pixel, 255] })
  } as unknown as CanvasRenderingContext2D);
}

export function dataTransfer() {
  const data = new Map<string, string>();
  const types: string[] = [];

  return {
    dropEffect: "none",
    effectAllowed: "none",
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
      types.push(type);
    },
    types
  };
}

export function dropOnCanvas(
  canvas: HTMLElement,
  transfer: ReturnType<typeof dataTransfer>,
  clientX: number,
  clientY: number
) {
  const event = new Event("drop", { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: transfer }
  });
  act(() => {
    canvas.dispatchEvent(event);
  });
}
