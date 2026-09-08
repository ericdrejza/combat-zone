import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  COMPACT_LAYOUT_BREAKPOINT_PX,
  COMPACT_LAYOUT_QUERY
} from "@hooks/useCompactLayout";
import { TOUCH_PRIMARY_INPUT_QUERY } from "@hooks/useMobileControls";
import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

function installCompactMatchMedia() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    matches: query === COMPACT_LAYOUT_QUERY,
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
    const compactQuery = query === COMPACT_LAYOUT_QUERY;
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
        media: COMPACT_LAYOUT_QUERY
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    }
  };
}

describe("responsive workspace", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));

  it("uses one exact compact-to-desktop transition at 1024 CSS pixels", () => {
    expect(COMPACT_LAYOUT_BREAKPOINT_PX).toBe(1024);
    expect(COMPACT_LAYOUT_QUERY).toBe("(width < 1024px)");
  });

  it("keeps the panel launcher hidden while docked sidebars are visible", () => {
    const restoreMatchMedia = installTouchDesktopMatchMedia();

    try {
      renderApp();

      expect(screen.getByLabelText("left docked panels")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Library panel" })
      ).not.toBeInTheDocument();
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

      expect(within(tools).getAllByRole("button")[0]).toHaveAccessibleName(
        "Rename encounter Untitled Encounter"
      );
      expect(
        within(tools).queryByRole("button", { name: "Engage selected actors" })
      ).not.toBeInTheDocument();
      expect(
        within(tools).queryByRole("button", { name: "Disengage selected actors" })
      ).not.toBeInTheDocument();

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
      const renameButton = screen.getByRole("button", {
        name: "Rename encounter Untitled Encounter"
      });
      expect(renameButton).toBeInTheDocument();
      expect(renameButton.querySelector("svg")).not.toBeNull();

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

  it("omits hidden dockable panels from the compact launcher", () => {
    const restoreMatchMedia = installCompactMatchMedia();
    localStorage.setItem(
      INTERFACE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        panelVisibility: {
          initiative: false,
          library: false,
          log: false,
          properties: false,
          status: false
        }
      })
    );

    try {
      renderApp();
      expect(
        screen.getByRole("button", { name: "Zoneless panel" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Library panel" })
      ).not.toBeInTheDocument();
    } finally {
      restoreMatchMedia();
    }
  });

  it("shows the encounter name after holding the compact toolbar rename button", () => {
    vi.useFakeTimers();
    const restoreMatchMedia = installCompactMatchMedia();

    try {
      renderApp();
      const renameButton = screen.getByRole("button", {
        name: "Rename encounter Untitled Encounter"
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
