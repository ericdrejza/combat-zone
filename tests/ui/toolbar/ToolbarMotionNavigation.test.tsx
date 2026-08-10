import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { setDragActionPreview } from "@interaction/interactionState";
import { MOTION_OVERRIDE_STORAGE_KEY } from "@ui/motion_preferences/MotionPreferenceProvider";

describe("Toolbar motion and navigation", () => {
  it("warns about reduced motion and persists an app animation override", async () => {
    const user = userEvent.setup();
    const originalMatchMedia = globalThis.matchMedia;

    localStorage.removeItem(MOTION_OVERRIDE_STORAGE_KEY);
    globalThis.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      removeEventListener: vi.fn()
    });

    try {
      const { unmount } = renderApp();

      const warning = screen.getByRole("button", {
        name: "Animations are disabled. Enable animations"
      });

      expect(warning).toHaveAttribute(
        "title",
        "Your system preference disables animation effects. Click to enable animations in Combat Zone."
      );

      await user.click(warning);

      expect(
        screen.queryByRole("button", {
          name: "Animations are disabled. Enable animations"
        })
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(MOTION_OVERRIDE_STORAGE_KEY)).toBe("true");

      unmount();
      renderApp();

      expect(
        screen.queryByRole("button", {
          name: "Animations are disabled. Enable animations"
        })
      ).not.toBeInTheDocument();
    } finally {
      localStorage.removeItem(MOTION_OVERRIDE_STORAGE_KEY);
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  it("renders toolbar tools in the expected order with requested separators", () => {
    renderApp();
    const tools = screen.getByRole("navigation", { name: "Tools" });

    expect(
      within(tools)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual([
      "Library",
      "Background",
      "Zone",
      "Edge",
      "Annotation",
      "Actor",
      "Select",
      "",
      ""
    ]);
    expect(screen.getAllByRole("button", { name: "Library" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Background" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Engage selected actors" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disengage selected actors" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(tools).getAllByRole("separator")).toHaveLength(6);
  });

  it("shows drag action previews with the activated toolbar color", () => {
    renderApp();
    const engage = screen.getByRole("button", {
      name: "Engage selected actors"
    });
    const disengage = screen.getByRole("button", {
      name: "Disengage selected actors"
    });

    act(() => {
      store.dispatch(setDragActionPreview("engage"));
    });
    expect(engage).toHaveAttribute("aria-pressed", "true");
    expect(engage).toHaveClass("bg-canvas-ink", "text-white");
    expect(disengage).toHaveAttribute("aria-pressed", "false");

    act(() => {
      store.dispatch(setDragActionPreview("disengage"));
    });
    expect(disengage).toHaveAttribute("aria-pressed", "true");
    expect(disengage).toHaveClass("bg-canvas-ink", "text-white");
    expect(engage).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the Asset Library modal from the Library toolbar button", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));

    expect(screen.getByRole("dialog", { name: "Asset Library" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Encounters" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));

    expect(
      screen.queryByRole("dialog", { name: "Asset Library" })
    ).not.toBeInTheDocument();
  });
});
