import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsModal } from "@ui/settings/SettingsModal";

describe("SettingsModal local reset", () => {
  it("places workspace export beside workspace import", () => {
    render(
      <SettingsModal
        onClose={() => undefined}
        onExportWorkspace={() => undefined}
        onImportWorkspaceFile={() => undefined}
        onResetLocalData={() => undefined}
        readOnly={false}
      />
    );

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
});
