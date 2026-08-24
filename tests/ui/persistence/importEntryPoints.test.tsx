import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  EXPORT_SCHEMA_VERSION,
  WORKSPACE_SCHEMA_VERSION,
  createEmptyLibraryState,
  type EncounterExportEnvelope,
  type WorkspaceExportEnvelope
} from "@core/persistence";
import { renderApp } from "@tests/ui/renderApp";

const timestamp = 1;

function encounterEnvelope(): EncounterExportEnvelope {
  return {
    kind: "encounter-export",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: timestamp,
    encounter: createEncounterState({ id: "imported", name: "Imported" }),
    library: createEmptyLibraryState()
  };
}

function workspaceEnvelope(): WorkspaceExportEnvelope {
  return {
    kind: "workspace-export",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: timestamp,
    workspace: {
      manifest: {
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        activeEncounterId: null,
        revision: 0,
        updatedAt: timestamp
      },
      encounters: [],
      recoveryDraft: null,
      library: {
        state: createEmptyLibraryState(),
        revision: 0,
        updatedAt: timestamp
      }
    }
  };
}

function jsonFile(envelope: object): File {
  return {
    name: "import.json",
    text: async () => JSON.stringify(envelope)
  } as File;
}

describe("persistence import entry points", () => {
  it("offers encounter import in the Encounter Library Add menu", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("button", { name: "Add to Encounters" }));

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent?.trim())
    ).toEqual(["Create encounter", "Import encounter", "Create folder"]);
  });

  it("rejects encounter files from workspace settings with a modal", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.change(screen.getByLabelText("Import workspace JSON"), {
      target: { files: [jsonFile(encounterEnvelope())] }
    });

    expect(
      await screen.findByRole("dialog", { name: "Wrong import file type" })
    ).toHaveTextContent("encounter file from the workspace import action");
  });

  it("rejects workspace files from encounter import with a modal", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    fireEvent.change(screen.getByLabelText("Import encounter JSON"), {
      target: { files: [jsonFile(workspaceEnvelope())] }
    });

    expect(
      await screen.findByRole("dialog", { name: "Wrong import file type" })
    ).toHaveTextContent("workspace file from the encounter import action");
  });
});
