import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppPersistenceUi } from "@ui/persistence/useAppPersistenceUi";

const persistence = vi.hoisted(() => ({
  activeRecord: null,
  createNewEncounter: vi.fn().mockResolvedValue(undefined),
  loadEncounter: vi.fn().mockResolvedValue(undefined),
  readOnly: false,
  saveStatus: "saved"
}));

vi.mock("@ui/persistence/PersistenceProvider", () => ({
  usePersistence: () => persistence
}));
vi.mock("@ui/cloud_sync", () => ({ useOptionalCloudSync: () => null }));
vi.mock("@ui/settings/SettingsModal", () => ({
  SettingsModal: () => <div aria-label="Settings" role="dialog" />
}));
vi.mock("@ui/library/AssetLibraryModal", () => ({
  AssetLibraryModal: ({ onRequestLoadEncounter, mode }: {
    onRequestLoadEncounter: (id: string) => void;
    mode: string;
  }) => (
    <div aria-label="Asset Library" role="dialog">
      <span>{mode}</span>
      <button onClick={() => onRequestLoadEncounter("saved-encounter")}>Load encounter</button>
    </div>
  )
}));

function Harness() {
  const ui = useAppPersistenceUi({
    onAudioDoubleClick: vi.fn(),
    onActorTokenSelect: vi.fn(),
    onBackgroundDoubleClick: vi.fn(),
    onTokenDoubleClick: vi.fn()
  });
  return <>
    <button onClick={() => ui.openLibrary()}>Library</button>
    <button onClick={ui.openSettings}>Settings</button>
    <span data-testid="library-visible">{String(ui.libraryOpen)}</span>
    {ui.dialogs}
  </>;
}

function requestLoad() {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  fireEvent.click(screen.getByRole("button", { name: "Load encounter" }));
  return screen.getByRole("dialog", { name: "Save encounter draft" });
}

describe("Persistence dialog coordination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("suspends the Library for the unsaved prompt and restores it on Cancel", () => {
    const prompt = requestLoad();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
    expect(screen.getByTestId("library-visible")).toHaveTextContent("false");
    expect(persistence.loadEncounter).not.toHaveBeenCalled();

    fireEvent.click(within(prompt).getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Asset Library" })).toBeInTheDocument();
    expect(persistence.loadEncounter).not.toHaveBeenCalled();
  });

  it("replaces the prompt with the save-destination picker", () => {
    const prompt = requestLoad();
    fireEvent.click(within(prompt).getByRole("button", { name: "Save" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Asset Library" })).toHaveTextContent("save-destination");
    expect(persistence.loadEncounter).not.toHaveBeenCalled();
  });

  it("keeps the prompt visible if another modal is requested", () => {
    requestLoad();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const prompt = screen.getByRole("dialog", { name: "Save encounter draft" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });
});
