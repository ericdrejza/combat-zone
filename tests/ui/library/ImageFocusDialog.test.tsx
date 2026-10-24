import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageAssetResolverProvider } from "@core/assets/ImageAssetResolver";
import { ImageFocusDialog } from "@ui/library/ImageFocusDialog";

const source = { kind: "url" as const, url: "https://example.com/token.png" };
const base = { title: "Adjust image focus", source, readOnly: false, onClose: vi.fn(), onSave: vi.fn() };

async function loadFocusArtwork(width = 600, height = 600) {
  const image = await screen.findByRole("img", { name: "Focus artwork" });
  Object.defineProperties(image, { naturalWidth: { configurable: true, value: width }, naturalHeight: { configurable: true, value: height } });
  fireEvent.load(image);
  return image;
}

it("edits the draft with zoom, pointer dragging, and keyboard input while keeping both guides mounted", async () => {
  const onSave = vi.fn();
  render(<ImageFocusDialog {...base} onSave={onSave} />);
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  await loadFocusArtwork(1200, 600);
  const square = screen.getByLabelText("Square capture outline"), circle = screen.getByLabelText("Circle capture outline");
  fireEvent.change(screen.getByRole("slider", { name: "Image zoom" }), { target: { value: "200" } });
  const area = screen.getByRole("group", { name: "Image focus area" });
  area.getBoundingClientRect = () => ({ width: 320, height: 320 } as DOMRect);
  fireEvent.pointerDown(area, { button: 0, pointerId: 1, clientX: 160, clientY: 160 });
  fireEvent.pointerMove(area, { pointerId: 1, clientX: 192, clientY: 160 });
  fireEvent.pointerUp(area, { pointerId: 1, clientX: 192, clientY: 160 });
  fireEvent.keyDown(area, { key: "ArrowRight" });
  expect(screen.getByLabelText("Square capture outline")).toBe(square);
  expect(screen.getByLabelText("Circle capture outline")).toBe(circle);
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave.mock.calls[0][0]).toMatchObject({ y: 0.25, width: 0.25, height: 0.5 });
  expect(onSave.mock.calls[0][0].x).toBeCloseTo(0.3475);
});

it("resets to the token snapshot or centered framing only when Save is selected", async () => {
  const onSave = vi.fn(), tokenFocus = { x: 0.125, y: 0.375, width: 0.25, height: 0.25 };
  render(<ImageFocusDialog {...base} onSave={onSave} tokenFocus={tokenFocus} />);
  await loadFocusArtwork();
  fireEvent.click(screen.getByRole("button", { name: "Reset to token match" }));
  expect(screen.getByRole("slider", { name: "Image zoom" })).toHaveValue("400");
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave).toHaveBeenLastCalledWith(tokenFocus);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave).toHaveBeenLastCalledWith(undefined);
});

it("hides token match when unavailable and cancels via Cancel, Escape, or backdrop without saving", async () => {
  const onSave = vi.fn(), onClose = vi.fn();
  render(<ImageFocusDialog {...base} onSave={onSave} onClose={onClose} />);
  await loadFocusArtwork();
  expect(screen.queryByRole("button", { name: "Reset to token match" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider"), { target: { value: "250" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.pointerDown(screen.getByRole("dialog"), { button: 0 });
  expect(onClose).toHaveBeenCalledTimes(3);
  expect(onSave).not.toHaveBeenCalled();
});

it("traps keyboard focus and restores the opening control on close", async () => {
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  const { unmount } = render(<ImageFocusDialog {...base} />);
  await loadFocusArtwork();
  const save = screen.getByRole("button", { name: "Save" });
  save.focus(); fireEvent.keyDown(save, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Close image focus" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true }); expect(save).toHaveFocus();
  unmount(); expect(opener).toHaveFocus(); opener.remove();
});

it("keeps saved state untouched on image resolution or decoding failures", async () => {
  const onSave = vi.fn();
  const { unmount } = render(<ImageFocusDialog {...base} onSave={onSave} />);
  fireEvent.error(await screen.findByRole("img", { name: "Focus artwork" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  unmount();
  render(<ImageAssetResolverProvider resolve={async () => { throw new Error("Missing asset"); }}>
    <ImageFocusDialog {...base} source={{ kind: "local_asset", assetId: "missing", byteLength: 1 }} onSave={onSave} />
  </ImageAssetResolverProvider>);
  await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  expect(onSave).not.toHaveBeenCalled();
});

it("disables editing after the workspace becomes read-only", async () => {
  const user = userEvent.setup(), onSave = vi.fn();
  const { rerender } = render(<ImageFocusDialog {...base} onSave={onSave} />);
  await loadFocusArtwork();
  rerender(<ImageFocusDialog {...base} onSave={onSave} readOnly />);
  expect(screen.getByRole("slider")).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave).not.toHaveBeenCalled();
});

it("can frame video from its metadata without waiting for playback", async () => {
  const onSave = vi.fn();
  render(<ImageFocusDialog {...base} mediaType="video/webm" onSave={onSave} />);
  const video = await screen.findByLabelText("Focus artwork");
  Object.defineProperties(video, { videoWidth: { value: 1200 }, videoHeight: { value: 600 } });
  fireEvent.loadedMetadata(video);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "200" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave).toHaveBeenCalledWith({ x: 0.375, y: 0.25, width: 0.25, height: 0.5 });
});
