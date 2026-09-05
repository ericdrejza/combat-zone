import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { openBackgroundLibrary } from "./AssetLibraryModal.test_support";
import { renderApp } from "@tests/ui/renderApp";

function currentFolderName() {
  return within(
    screen.getByRole("region", { name: "Asset library contents" })
  ).getByLabelText("Current asset library folder").textContent;
}

async function createFolderInActiveSection(
  user: ReturnType<typeof import("@testing-library/user-event").default.setup>,
  sectionName: string,
  folderName: string
) {
  await user.click(
    screen.getByRole("button", { name: `Add to ${sectionName}` })
  );
  await user.click(screen.getByRole("menuitem", { name: "Create folder" }));
  const dialog = screen.getByRole("dialog", { name: "Create folder" });
  await user.type(
    within(dialog).getByRole("textbox", { name: "Folder name" }),
    folderName
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Create folder" })
  );
}

describe("AssetLibraryModal session state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("remembers the current directory independently for each library tab", async () => {
    const user = await openBackgroundLibrary();
    expect(
      screen.getByRole("button", { name: "Locate current directory" })
    ).toBeInTheDocument();

    await createFolderInActiveSection(user, "Backgrounds", "Maps");
    await user.click(screen.getByRole("button", { name: "Maps" }));
    expect(currentFolderName()).toBe("Maps");

    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    expect(
      screen.getByRole("button", { name: "Locate current directory" })
    ).toBeInTheDocument();
    expect(currentFolderName()).toBe("Tokens");
    await createFolderInActiveSection(user, "Tokens", "Portraits");
    await user.click(screen.getByRole("button", { name: "Portraits" }));
    expect(currentFolderName()).toBe("Portraits");

    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    expect(currentFolderName()).toBe("Maps");

    await user.click(screen.getByRole("tab", { name: "Encounters" }));
    expect(
      screen.getByRole("button", { name: "Locate current directory" })
    ).toBeInTheDocument();
    expect(currentFolderName()).toBe("Encounters");
    await createFolderInActiveSection(user, "Encounters", "Saved");
    await user.click(screen.getByRole("button", { name: "Saved" }));
    expect(currentFolderName()).toBe("Saved");

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    expect(currentFolderName()).toBe("Maps");

    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    expect(currentFolderName()).toBe("Portraits");

    await user.click(screen.getByRole("tab", { name: "Encounters" }));
    expect(currentFolderName()).toBe("Saved");
  });

  it("remembers the contents view independently for each library tab and modal reopen", async () => {
    const user = await openBackgroundLibrary();

    await user.click(
      screen.getByRole("button", {
        name: "Switch library contents to list view"
      })
    );

    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    expect(
      screen.getByRole("button", {
        name: "Switch library contents to list view"
      })
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Switch library contents to list view"
      })
    );

    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    expect(
      screen.getByRole("button", {
        name: "Switch library contents to grid view"
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    expect(
      screen.getByRole("button", {
        name: "Switch library contents to grid view"
      })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    expect(
      screen.getByRole("button", {
        name: "Switch library contents to grid view"
      })
    ).toBeInTheDocument();
  });

  it("opens the tab matching the active toolbar tool", async () => {
    const user = userEvent.setup();

    renderApp();
    await user.click(screen.getByRole("button", { name: "Background" }));
    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(screen.getByRole("tab", { name: "Backgrounds" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(screen.getByRole("tab", { name: "Tokens" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("expands only the remembered folder path when reopened", async () => {
    const user = await openBackgroundLibrary();

    await createFolderInActiveSection(user, "Backgrounds", "Maps");
    await createFolderInActiveSection(user, "Backgrounds", "Other");
    await user.click(screen.getAllByText("Maps")[0]);
    await createFolderInActiveSection(user, "Backgrounds", "Nested");
    await user.click(
      within(
        screen.getByRole("group", { name: "Current directory contents" })
      ).getByRole("button", { name: "Nested" })
    );

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));

    expect(screen.getByRole("button", { name: "Collapse Maps" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Nested" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Other" })).toBeInTheDocument();
  });
});
