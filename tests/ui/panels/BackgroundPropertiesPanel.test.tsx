import { act, screen, within } from "@testing-library/react";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { setActiveTool } from "@interaction/interactionState";
import { createFolder, uploadImage } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("BackgroundPropertiesPanel", () => {
  it("shows Name, Library Path, and URL in order for a linked Library asset", () => {
    renderApp();
    const folderAction = createFolder({
      name: "Maps",
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    });
    const imageAction = uploadImage({
      asset: {
        dataUrl: "https://assets.example/ancient-ruins.webp",
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
    const url = within(panel).getByRole("textbox", { name: "URL" });

    expect(name).toHaveValue("ancient-ruins");
    expect(libraryPath).toHaveValue(
      "Backgrounds/Maps/ancient-ruins.webp"
    );
    expect(url).toHaveValue("https://assets.example/ancient-ruins.webp");
    expect(name).toHaveAttribute("readonly");
    expect(libraryPath).toHaveAttribute("readonly");
    expect(url).toHaveAttribute("readonly");
    expect(name.compareDocumentPosition(libraryPath)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(libraryPath.compareDocumentPosition(url)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
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
            dataUrl: "data:image/png;base64,bWFw",
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
});
