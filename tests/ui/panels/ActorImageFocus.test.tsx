import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createActor } from "@entities/actor/actorMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { setTokenImageFocus, uploadImage } from "@library/librarySlice";
import { loadEncounterState, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

const focus = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
function setup(linked = true) {
  renderApp();
  const upload = uploadImage({ sectionId: "tokens", parentId: "tokens-root", asset: {
    imageFocus: focus, name: "Token", mediaType: "image/png", source: { kind: "url", url: "https://example.com/token.png" }
  } });
  act(() => {
    store.dispatch(upload);
    const encounter = createActor(store.getState().encounter.present, { id: "a", currentZoneId: "zoneless", image: {
      ...upload.payload.asset, ...(linked ? { libraryNodeId: upload.payload.id } : {})
    } });
    store.dispatch(loadEncounterState(encounter));
    store.dispatch(setActiveTool("select"));
    store.dispatch(selectEntity({ entityType: "actor", ids: ["a"] }));
  });
  return upload.payload.id;
}

async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Adjust actor image focus" }));
  const image = await screen.findByRole("img", { name: "Focus artwork" });
  Object.defineProperties(image, { naturalWidth: { value: 600 }, naturalHeight: { value: 600 } });
  fireEvent.load(image);
  return screen.getByRole("dialog", { name: "Adjust actor image focus" });
}

it("saves actor-only focus with undo/redo, then matches today's token default without following future changes", async () => {
  const user = userEvent.setup(), id = setup();
  const libraryBefore = store.getState().library;
  const original = store.getState().encounter.present;
  let dialog = await open();
  fireEvent.change(within(dialog).getByRole("slider"), { target: { value: "400" } });
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.imageFocus?.width).toBe(0.25));
  const custom = store.getState().encounter.present;
  expect(store.getState().library).toBe(libraryBefore);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(original);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(custom);
  const currentDefault = { x: 0, y: 0, width: 0.5, height: 0.5 };
  act(() => { store.dispatch(setTokenImageFocus({ sectionId: "tokens", nodeId: id, focus: currentDefault })); });
  dialog = await open();
  await user.click(within(dialog).getByRole("button", { name: "Reset to token match" }));
  expect(store.getState().encounter.present).toBe(custom);
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.imageFocus).toEqual(currentDefault));
  act(() => { store.dispatch(setTokenImageFocus({ sectionId: "tokens", nodeId: id, focus })); });
  expect(store.getState().encounter.present.actors.byId.a.imageFocus).toEqual(currentDefault);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(custom);
});

it("hides token match for direct images and avoids history when cancelling or saving unchanged", async () => {
  setup(false);
  const before = store.getState().encounter;
  let dialog = await open();
  expect(within(dialog).queryByRole("button", { name: "Reset to token match" })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(store.getState().encounter).toBe(before);
  dialog = await open();
  fireEvent.change(within(dialog).getByRole("slider"), { target: { value: "400" } });
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Adjust actor image focus" })).not.toBeInTheDocument();
  expect(store.getState().encounter).toBe(before);
});

it("opens the same editor from the token card menu and leaves existing actors unchanged", async () => {
  const user = userEvent.setup(), id = setup();
  const before = store.getState().encounter;
  await user.click(screen.getByRole("button", { name: "Library" }));
  await user.click(screen.getByRole("tab", { name: "Tokens" }));
  const library = screen.getByRole("dialog", { name: "Asset Library" });
  fireEvent.contextMenu(within(library).getByRole("button", { name: "Token" }));
  await user.click(screen.getByRole("menuitem", { name: "Adjust image focus" }));
  const image = await screen.findByRole("img", { name: "Focus artwork" });
  Object.defineProperties(image, { naturalWidth: { value: 600 }, naturalHeight: { value: 600 } });
  fireEvent.load(image);
  const dialog = screen.getByRole("dialog", { name: "Adjust token default focus" });
  fireEvent.change(within(dialog).getByRole("slider"), { target: { value: "400" } });
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(store.getState().library.sections.tokens.nodesById[id].asset?.imageFocus?.width).toBe(0.25);
  expect(store.getState().encounter).toBe(before);
});
