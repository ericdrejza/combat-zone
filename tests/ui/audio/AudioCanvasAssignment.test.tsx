import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createActor } from "@entities/actor/actorMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity, setActiveTool, setAudioCueType, setAudioSectionType } from "@interaction/interactionState";
import { createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";
import { LIBRARY_NODE_DRAG_TYPE } from "@ui/library/libraryDrag";

describe("Audio canvas assignment", () => {
  it("asks which inherited group receives a drop when several are available", async () => {
    const user = userEvent.setup();
    renderApp();
    mockCanvasBounds(getCanvas());
    let encounter = createZone(store.getState().encounter.present, {
      id: "room",
      name: "Room",
      polygon: [
        { x: 50, y: 50 },
        { x: 250, y: 50 },
        { x: 250, y: 250 },
        { x: 50, y: 250 }
      ]
    });
    encounter = createActor(encounter, {
      currentZoneId: "room",
      id: "guard",
      name: "Guard"
    });
    encounter = createAudioCueGroup(encounter, { id: "weather", name: "Weather", section: "zone" });
    encounter = createAudioCueGroup(encounter, { id: "danger", name: "Danger", section: "zone" });
    encounter = setEntityAudioGroups(encounter, "zone", "room", ["weather", "danger"]);

    act(() => {
      store.dispatch(commitEncounterChange({
        action: { id: "setup", payload: {}, timestamp: 1, type: "test.setup" },
        nextEncounter: encounter
      }));
      store.dispatch(uploadImage({
        asset: {
          mediaType: "audio/mpeg",
          name: "Warning",
          source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" }
        },
        parentId: "audio-root",
        sectionId: "audio"
      }));
      store.dispatch(setActiveTool("audio"));
      store.dispatch(setAudioSectionType("zone"));
      store.dispatch(selectEntity({ entityType: "zone", ids: ["room"], userInitiated: true }));
    });

    expect(within(screen.getByLabelText("Properties panel")).getByText("Room")).toBeInTheDocument();

    const nodeId = store.getState().library.sections.audio.nodesById["audio-root"].childIds?.[0] as string;
    const dataTransfer = {
      dropEffect: "none",
      getData: (type: string) => type === LIBRARY_NODE_DRAG_TYPE ? nodeId : "",
      types: [LIBRARY_NODE_DRAG_TYPE]
    };
    fireEvent.drop(screen.getByLabelText("Guard"), {
      clientX: 120,
      clientY: 120,
      dataTransfer
    });

    const picker = screen.getByRole("dialog", { name: "Choose audio group" });
    await user.click(within(picker).getByRole("button", { name: /Weather/ }));

    const cue = Object.values(store.getState().encounter.present.audioCues.byId)[0];
    expect(cue).toMatchObject({
      libraryNodeId: nodeId,
      placement: { type: "group", groupId: "weather" },
      type: "one_shot"
    });
  });

  it("offers creating a destination group as the final cue destination", async () => {
    const user = userEvent.setup();
    renderApp();
    act(() => {
      store.dispatch(uploadImage({
        asset: { mediaType: "audio/mpeg", name: "Theme", source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" } },
        parentId: "audio-root",
        sectionId: "audio"
      }));
      store.dispatch(setActiveTool("audio"));
      store.dispatch(setAudioSectionType("encounter"));
    });

    await user.dblClick(within(screen.getByLabelText("Library panel")).getByRole("button", { name: "Theme" }));
    const dialog = screen.getByRole("dialog", { name: "Choose audio destination" });
    const createGroup = within(dialog).getByRole("button", { name: "Create new Music group" });
    expect(within(dialog).getByRole("button", { name: "Create new Ambience group" })).toBeInTheDocument();
    await user.click(createGroup);
    const naming = screen.getByRole("dialog", { name: "Name new cue group" });
    await user.click(within(naming).getByRole("button", { name: "Create" }));

    const encounter = store.getState().encounter.present;
    const group = encounter.audioCueGroups.byId[encounter.musicGroupIds[0]];
    const cue = encounter.audioCues.byId[encounter.audioCues.allIds[0]];
    expect(group.section).toBe("music");
    expect(cue).toMatchObject({ placement: { type: "group", groupId: group.id }, type: "loop" });
  });

  it("offers a new Ambience group for encounter Effect drops even without existing groups", () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    act(() => {
      store.dispatch(uploadImage({
        asset: { mediaType: "audio/mpeg", name: "Warning", source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" } },
        parentId: "audio-root", sectionId: "audio"
      }));
      store.dispatch(setActiveTool("audio"));
      store.dispatch(setAudioSectionType("encounter"));
      store.dispatch(setAudioCueType("one_shot"));
    });
    const nodeId = store.getState().library.sections.audio.nodesById["audio-root"].childIds![0];
    fireEvent.drop(canvas, {
      clientX: 100, clientY: 100,
      dataTransfer: { getData: (type: string) => type === LIBRARY_NODE_DRAG_TYPE ? nodeId : "", types: [LIBRARY_NODE_DRAG_TYPE] }
    });
    const dialog = screen.getByRole("dialog", { name: "Choose audio destination" });
    expect(within(dialog).queryByRole("button", { name: "Create new Music group" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create new Ambience group" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Name new cue group" })).getByRole("button", { name: "Create" }));
    const encounter = store.getState().encounter.present;
    const cue = encounter.audioCues.byId[encounter.audioCues.allIds[0]];
    expect(cue).toMatchObject({ libraryNodeId: nodeId, type: "one_shot", volume: 0.5 });
    expect(encounter.audioCueGroups.byId[cue.placement.groupId].section).toBe("ambiance");
  });
});
