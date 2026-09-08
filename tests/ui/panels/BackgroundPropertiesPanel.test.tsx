import userEvent from "@testing-library/user-event";
import { act, fireEvent, screen, within } from "@testing-library/react";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { setActiveTool } from "@interaction/interactionState";
import { createFolder, uploadImage } from "@library/librarySlice";
import {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("BackgroundPropertiesPanel", () => {
  it("shows Name and Library Path without duplicating a linked asset URL", () => {
    renderApp();
    const folderAction = createFolder({
      name: "Maps",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    });
    const imageAction = uploadImage({
      asset: {
        source: { kind: "url", url: "https://assets.example/ancient-ruins.webp" },
        height: 720,
        mediaType: "image/webp",
        name: "ancient-ruins.webp",
        width: 1280
      },
      parentId: folderAction.payload.id,
      sectionId: "backgrounds"
    });

    act(() => {
      store.dispatch(folderAction);
      store.dispatch(imageAction);
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("background.add"),
        nextEncounter: {
          ...encounter,
          backgroundImage: {
            ...imageAction.payload.asset,
            height: 720,
            libraryNodeId: imageAction.payload.id,
            width: 1280
          }
        }
      }));
      store.dispatch(setActiveTool("background"));
    });

    const panel = screen.getByRole("region", { name: "Properties panel" });
    const name = within(panel).getByRole("textbox", { name: "Name" });
    const libraryPath = within(panel).getByRole("textbox", {
      name: "Library Path"
    });

    expect(name).toHaveValue("ancient-ruins");
    expect(libraryPath).toHaveValue(
      "Backgrounds/Maps/ancient-ruins.webp"
    );
    expect(name).toHaveAttribute("readonly");
    expect(libraryPath).toHaveAttribute("readonly");
    expect(name.compareDocumentPosition(libraryPath)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(within(panel).queryByRole("textbox", { name: "URL" }))
      .not.toBeInTheDocument();
  });

  it("hides Library Path and URL for a directly uploaded background", () => {
    renderApp();

    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("background.add"),
        nextEncounter: {
          ...encounter,
          backgroundImage: {
            source: { kind: "embedded", dataUrl: "data:image/png;base64,bWFw" },
            height: 640,
            mediaType: "image/png",
            name: "battle-map.png",
            width: 960
          }
        }
      }));
      store.dispatch(setActiveTool("background"));
    });

    const panel = screen.getByRole("region", { name: "Properties panel" });
    expect(within(panel).getByRole("textbox", { name: "Name" })).toHaveValue(
      "battle-map"
    );
    expect(
      within(panel).queryByRole("textbox", { name: "Library Path" })
    ).not.toBeInTheDocument();
    expect(
      within(panel).queryByRole("textbox", { name: "URL" })
    ).not.toBeInTheDocument();
  });

  it("edits and history-tracks the name of a direct web background", () => {
    renderApp();

    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("background.add"),
        nextEncounter: {
          ...encounter,
          backgroundImage: {
            source: { kind: "url", url: "https://example.com/remote-map.png" },
            height: 640,
            mediaType: "image/png",
            name: "remote-map",
            width: 960
          }
        }
      }));
      store.dispatch(setActiveTool("background"));
    });

    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).not.toHaveAttribute("readonly");
    fireEvent.change(name, { target: { value: "Renamed Map" } });
    fireEvent.blur(name);

    expect(store.getState().encounter.present.backgroundImage?.name)
      .toBe("Renamed Map");
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present.backgroundImage?.name)
      .toBe("remote-map");
    act(() => { store.dispatch(redoEncounterChange()); });
    expect(store.getState().encounter.present.backgroundImage?.name)
      .toBe("Renamed Map");

    const renamedName = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(renamedName, { target: { value: "   " } });
    fireEvent.blur(renamedName);
    expect(store.getState().encounter.present.backgroundImage?.name).toBe("");
  });

  it("opens the library at the linked asset's directory", async () => {
    const user = userEvent.setup();
    renderApp();
    const folderAction = createFolder({
      name: "Maps",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    });
    const imageAction = uploadImage({
      asset: {
        height: 720,
        mediaType: "image/png",
        name: "ancient-ruins.png",
        source: {
          dataUrl: "data:image/png;base64,ancient-ruins",
          kind: "embedded"
        },
        width: 1280
      },
      parentId: folderAction.payload.id,
      sectionId: "backgrounds"
    });

    act(() => {
      store.dispatch(folderAction);
      store.dispatch(imageAction);
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("background.add"),
        nextEncounter: {
          ...encounter,
          backgroundImage: {
            ...imageAction.payload.asset,
            height: 720,
            libraryNodeId: imageAction.payload.id,
            width: 1280
          }
        }
      }));
      store.dispatch(setActiveTool("background"));
    });

    await user.click(screen.getByRole("textbox", { name: "Library Path" }));

    expect(screen.getByRole("dialog", { name: "Asset Library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ancient-ruins.png" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(
      within(
        screen.getByRole("region", { name: "Asset library contents" })
      ).getByLabelText("Current asset library folder")
    ).toHaveTextContent("Maps");
  });
});
