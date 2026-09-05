import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "@tests/ui/renderApp";

export async function openBackgroundLibrary() {
  const user = userEvent.setup();

  renderApp();

  await user.click(screen.getByRole("button", { name: "Library" }));
  await user.click(screen.getByRole("tab", { name: "Backgrounds" }));

  return user;
}

export async function createFolder(name: string) {
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
  await user.click(screen.getByRole("menuitem", { name: "Create folder" }));
  const dialog = screen.getByRole("dialog", { name: "Create folder" });
  await user.type(within(dialog).getByRole("textbox", { name: "Folder name" }), name);
  await user.click(within(dialog).getByRole("button", { name: "Create folder" }));
}

export function createDragDataTransfer() {
  const data = new Map<string, string>();
  const types: string[] = [];

  return {
    data,
    dropEffect: "",
    effectAllowed: "",
    files: [],
    items: [],
    types,
    getData(type: string) {
      return data.get(type) ?? "";
    },
    setData(type: string, value: string) {
      data.set(type, value);

      if (!types.includes(type)) {
        types.push(type);
      }
    }
  };
}
