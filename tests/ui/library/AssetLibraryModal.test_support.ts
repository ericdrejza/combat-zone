import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderApp } from "@tests/ui/renderApp";

export async function openBackgroundLibrary() {
  const user = userEvent.setup();

  renderApp();

  await user.click(screen.getByRole("button", { name: "Library" }));
  await user.click(screen.getByRole("tab", { name: "Backgrounds" }));

  return user;
}

export async function createFolder(name: string) {
  vi.spyOn(window, "prompt").mockReturnValueOnce(name);

  await userEvent.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Create folder" }));
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
