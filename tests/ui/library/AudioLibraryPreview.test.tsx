import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLink, resolveLibraryAsset, uploadImage } from "@library/librarySlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
const originalMatchMedia = window.matchMedia;

function openAudioLibrary() {
  window.matchMedia = vi.fn((query: string) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn()
  }) as unknown as MediaQueryList);
  renderApp();
  act(() => {
    store.dispatch(uploadImage({
      sectionId: "audio", parentId: "audio-root",
      asset: { mediaType: "audio/mpeg", name: "Theme", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } }
    }));
  });
  const originalId = store.getState().library.sections.audio.nodesById["audio-root"].childIds![0];
  act(() => store.dispatch(createLink({ sectionId: "audio", parentId: "audio-root", targetId: originalId, name: "Alias" })));
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  fireEvent.click(screen.getByRole("tab", { name: "Audio" }));
  return { originalId, dialog: screen.getByRole("dialog", { name: "Asset Library" }) };
}

describe("Audio Library preview", () => {
  afterEach(() => { window.matchMedia = originalMatchMedia; vi.restoreAllMocks(); });
  it("plays grid previews in the footer and retains the same player and position across views", () => {
    const { dialog } = openAudioLibrary();
    const card = within(dialog).getByRole("button", { name: "Theme" });
    expect(within(card).getByRole("img", { name: "Audio asset" })).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
    fireEvent.click(card);
    expect(screen.queryByLabelText("Preview Theme")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Preview audio" }));
    const player = within(dialog).getByLabelText("Preview Theme") as HTMLAudioElement;
    expect(player.autoplay).toBe(true);
    expect(player).toHaveAttribute("controlslist", "noplaybackrate");
    const footer = within(dialog).getByRole("button", { name: "Add Cue" }).closest("footer")!;
    expect(within(footer).getByLabelText("Preview Theme")).toBe(player);
    expect(within(card).queryByRole("button")).toBeNull();
    player.currentTime = 42;
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch library contents to list view" }));
    expect(within(dialog).getByLabelText("Preview Theme")).toBe(player);
    expect(player.currentTime).toBe(42);
    expect(footer.contains(player)).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch library contents to grid view" }));
    expect(within(footer).getByLabelText("Preview Theme")).toBe(player);
    expect(player.currentTime).toBe(42);
    fireEvent.click(within(dialog).getByRole("button", { name: "Preview audio" }));
    expect(screen.queryByLabelText("Preview Theme")).not.toBeInTheDocument();
  });

  it("offers only the opposite icon and shares changes with linked cards", () => {
    const { originalId, dialog } = openAudioLibrary();
    const card = within(dialog).getByRole("button", { name: "Theme" });
    const alias = within(dialog).getByRole("button", { name: "Alias" });
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByRole("menuitem", { name: "Set icon to music" }));
    expect(within(card).getByRole("img", { name: "Music asset" })).toBeInTheDocument();
    expect(within(alias).getByRole("img", { name: "Music asset" })).toBeInTheDocument();
    fireEvent.contextMenu(alias);
    expect(screen.queryByRole("menuitem", { name: "Set icon to music" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Set icon to audio" }));
    expect(resolveLibraryAsset(store.getState().library.sections.audio, originalId)?.audioIcon).toBeUndefined();
    expect(within(card).getByRole("img", { name: "Audio asset" })).toBeInTheDocument();
    expect(within(alias).getByRole("img", { name: "Audio asset" })).toBeInTheDocument();
  });

  it("follows selection and ignores hover and touch-hold in both views", () => {
    const { dialog } = openAudioLibrary();
    act(() => store.dispatch(uploadImage({
      sectionId: "audio", parentId: "audio-root",
      asset: { mediaType: "audio/mpeg", name: "Rain", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AQ==" } }
    })));
    const theme = within(dialog).getByRole("button", { name: "Theme" });
    const rain = within(dialog).getByRole("button", { name: "Rain" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Preview audio" }));
    fireEvent.pointerEnter(theme, { pointerType: "mouse" });
    expect(screen.queryByLabelText("Preview Theme")).not.toBeInTheDocument();
    fireEvent.click(theme);
    const player = within(dialog).getByLabelText("Preview Theme") as HTMLAudioElement;
    player.currentTime = 25;
    for (const view of ["list", "grid"]) {
      fireEvent.click(within(dialog).getByRole("button", { name: `Switch library contents to ${view} view` }));
      fireEvent.pointerEnter(rain, { pointerType: "mouse" });
      fireEvent.pointerDown(rain, { pointerType: "touch", clientX: 100, clientY: 100 });
      fireEvent.pointerUp(rain, { pointerType: "touch" });
      expect(within(dialog).getByLabelText("Preview Theme")).toBe(player);
      expect(player.currentTime).toBe(25);
      expect(screen.queryByLabelText("Preview Rain")).not.toBeInTheDocument();
    }
    fireEvent.click(rain);
    expect(within(dialog).getByLabelText("Preview Rain")).toHaveAttribute("src", "data:audio/mpeg;base64,AQ==");
    expect(screen.queryByLabelText("Preview Theme")).not.toBeInTheDocument();
  });
});
