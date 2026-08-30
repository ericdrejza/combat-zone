import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TOUCH_PRIMARY_INPUT_QUERY } from "@hooks/useMobileControls";
import { renderApp } from "@tests/ui/renderApp";

function installCompactMatchMedia() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    matches: query === "(max-width: 1023px)",
    media: query,
    onchange: null,
    removeEventListener: vi.fn()
  }));
  return () => {
    window.matchMedia = original;
  };
}

function installTouchDesktopMatchMedia() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    matches: query === TOUCH_PRIMARY_INPUT_QUERY,
    media: query,
    onchange: null,
    removeEventListener: vi.fn()
  }));
  return () => {
    window.matchMedia = original;
  };
}

function installResponsiveMatchMedia(initialCompact: boolean) {
  const original = window.matchMedia;
  let compact = initialCompact;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const compactQuery = query === "(max-width: 1023px)";
    return {
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (compactQuery) listeners.add(listener);
      },
      get matches() {
        return compactQuery && compact;
      },
      media: query,
      onchange: null,
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }
    };
  });

  return {
    restore: () => {
      window.matchMedia = original;
    },
    setCompact: (nextCompact: boolean) => {
      compact = nextCompact;
      const event = {
        matches: compact,
        media: "(max-width: 1023px)"
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    }
  };
}

describe("responsive workspace", () => {
  it("keeps the panel launcher available when a touch phone requests desktop width", () => {
    const restoreMatchMedia = installTouchDesktopMatchMedia();

    try {
      renderApp();

      expect(screen.getByLabelText("left docked panels")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Library panel" })).toBeInTheDocument();
    } finally {
      restoreMatchMedia();
    }
  });

  it("uses icon tools, a secondary option strip, and compact panel launcher", async () => {
    const restoreMatchMedia = installCompactMatchMedia();
    const user = userEvent.setup();

    try {
      const { unmount } = renderApp();
      const tools = screen.getByRole("navigation", { name: "Tools" });

      for (const name of [
        "Library",
        "Background",
        "Zone",
        "Edge",
        "Annotation",
        "Actor",
        "Select"
      ]) {
        expect(
          within(tools).getByRole("button", { name }).querySelector("svg")
        ).not.toBeNull();
      }

      expect(screen.queryByLabelText("left docked panels")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("right docked panels")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Library panel" })).toBeInTheDocument();
      const renameButton = within(tools).getByRole("button", {
        name: /Rename encounter Untitled Encounter/
      });
      expect(renameButton).toBeInTheDocument();
      expect(renameButton.querySelector("svg")).not.toBeNull();
      expect(screen.getAllByRole("button", {
        name: /Rename encounter Untitled Encounter/
      })).toHaveLength(1);

      await user.click(within(tools).getByRole("button", { name: "Zone" }));
      expect(
        within(screen.getByLabelText("Active tool options")).getByRole(
          "radiogroup",
          { name: "Zone shape options" }
        )
      ).toBeInTheDocument();

      await user.click(
        within(tools).getByRole("button", { name: "Zoom controls" })
      );
      expect(
        within(screen.getByLabelText("Active tool options")).getByLabelText(
          "Canvas navigation"
        )
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Zone" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );

      await user.click(screen.getByRole("button", { name: "Zoom in" }));
      expect(screen.getByLabelText("Current zoom")).toHaveTextContent("110%");
      expect(
        within(screen.getByLabelText("Active tool options")).getByLabelText(
          "Canvas navigation"
        )
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Library panel" }));
      expect(
        screen.getByRole("heading", { name: "Library" })
      ).toBeInTheDocument();
      unmount();
    } finally {
      restoreMatchMedia();
    }
  });

  it("shows the encounter name after holding the compact toolbar rename button", () => {
    vi.useFakeTimers();
    const restoreMatchMedia = installCompactMatchMedia();

    try {
      renderApp();
      const tools = screen.getByRole("navigation", { name: "Tools" });
      const renameButton = within(tools).getByRole("button", {
        name: /Rename encounter Untitled Encounter/
      });

      fireEvent.pointerDown(renameButton, {
        button: 0,
        clientX: 24,
        clientY: 24,
        pointerId: 1,
        pointerType: "touch"
      });
      act(() => vi.advanceTimersByTime(500));

      expect(screen.getByRole("tooltip")).toHaveTextContent("Untitled Encounter");
      fireEvent.pointerUp(renameButton, { pointerId: 1, pointerType: "touch" });
    } finally {
      restoreMatchMedia();
      vi.useRealTimers();
    }
  });

  it("fits the remounted canvas after changing from desktop to compact", async () => {
    const media = installResponsiveMatchMedia(false);
    const user = userEvent.setup();

    try {
      renderApp();
      act(() => media.setCompact(true));
      const viewport = screen.getByLabelText("Canvas viewport");
      Object.defineProperties(viewport, {
        clientHeight: { configurable: true, value: 703 },
        clientWidth: { configurable: true, value: 372 }
      });

      await user.click(screen.getByRole("button", { name: "Zoom controls" }));
      await user.click(screen.getByRole("button", { name: "Zoom to fit" }));

      expect(viewport).toHaveAttribute("data-canvas-zoom", "0.388");
      expect(screen.getByRole("button", { name: "Zoom to fit" })).toBeInTheDocument();
    } finally {
      media.restore();
    }
  });
});
