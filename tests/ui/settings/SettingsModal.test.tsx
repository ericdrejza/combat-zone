import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KeybindProvider, KEYBIND_STORAGE_KEY } from "@ui/keybinds";
import { SettingsModal } from "@ui/settings/SettingsModal";
import { COMPACT_LAYOUT_QUERY } from "@hooks/useCompactLayout";

describe("SettingsModal local reset", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    localStorage.removeItem(KEYBIND_STORAGE_KEY);
    window.matchMedia = originalMatchMedia;
  });

  function renderSettings() {
    return render(
      <KeybindProvider>
        <SettingsModal
          onClose={() => undefined}
          onExportWorkspace={() => undefined}
          onImportWorkspaceFile={() => undefined}
          onResetLocalData={() => undefined}
          readOnly={false}
        />
      </KeybindProvider>
    );
  }

  it("places workspace export beside workspace import", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: "Data" }));

    expect(
      screen.getByRole("button", { name: "Export workspace" })
    ).toBeInTheDocument();
    expect(screen.getByText("Import workspace")).toBeInTheDocument();
  });

  it("requires the exact destructive confirmation phrase", async () => {
    const user = userEvent.setup();
    const onResetLocalData = vi.fn();
    render(
      <SettingsModal
        onClose={() => undefined}
        onExportWorkspace={() => undefined}
        onImportWorkspaceFile={() => undefined}
        onResetLocalData={onResetLocalData}
        readOnly={false}
      />
    );
    await user.click(screen.getByRole("tab", { name: "Data" }));

    await user.click(screen.getByRole("button", { name: "Reset local data" }));
    const finalReset = screen.getAllByRole("button", {
      name: "Reset local data"
    })[0];
    expect(finalReset).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "Local reset confirmation" }),
      "RESET LOCAL DATA"
    );
    expect(finalReset).toBeEnabled();
    await user.click(finalReset);
    expect(onResetLocalData).toHaveBeenCalledOnce();
  });

  it("groups alphabetized tabs and keeps account settings in the lower section", () => {
    renderSettings();

    expect(
      within(screen.getByRole("tablist", { name: "General settings" }))
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["Audio", "Interface", "Keybinds"]);
    expect(
      within(screen.getByRole("tablist", { name: "Account settings" }))
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["Account", "Data"]);
  });

  it("expands compact navigation for selection and collapses after selecting", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === COMPACT_LAYOUT_QUERY,
      media: query,
      onchange: null,
      removeEventListener: vi.fn()
    }));
    const user = userEvent.setup();
    renderSettings();

    const expand = screen.getByRole("button", {
      name: "Expand settings navigation"
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");

    await user.click(expand);
    expect(screen.getByRole("button", {
      name: "Collapse settings navigation"
    })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("tab", { name: "Interface" }));
    expect(screen.getByRole("button", {
      name: "Expand settings navigation"
    })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { name: "Interface" })).toBeInTheDocument();
  });

  it("shows the Light and Dark theme choices in Interface settings", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "Interface" }));

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
  });

  it("reassigns single-letter shortcuts and documents combinations as read-only", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "Keybinds" }));

    const actorTool = screen.getByRole("button", {
      name: "Change Activate Actor tool keybind"
    });
    await user.click(actorTool);
    fireEvent.keyDown(actorTool, { key: "g" });
    expect(actorTool).toHaveTextContent("G");
    expect(JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY)!)).toMatchObject({
      "tool.actor": "g"
    });

    expect(screen.queryByRole("button", {
      name: "Change Copy selected actor keybind"
    })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Copy selected actor keybind")).toHaveTextContent(
      "Ctrl/Cmd + C"
    );
  });
});
