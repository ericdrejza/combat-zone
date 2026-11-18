import { fireEvent, screen, within } from "@testing-library/react";
import { expect } from "vitest";

/** Exercise the popup's actual controls rather than synthesizing a native-select change. */
export function openEditorSelector(label: string) {
  const selector = screen.getByRole("combobox", { name: label });
  if (selector.getAttribute("aria-expanded") !== "true") fireEvent.click(selector);
  return screen.getByRole("dialog", { name: label });
}
export function chooseEditorRecord(label: string, id: string) {
  if ((id === "" || id === "create") && !screen.queryByRole("combobox", { name: label })) {
    fireEvent.click(screen.getByRole("button", { name: /^Create new /i })); return;
  }
  const popup = openEditorSelector(label);
  const buttons = within(popup).getAllByRole("button") as HTMLButtonElement[];
  const choice = id === "" || id === "create" ? buttons.find(button => /^Create new /i.test(button.textContent ?? "")) : buttons.find(button => button.value === id);
  if (!choice) throw new Error(`No editor choice for ${id}`);
  fireEvent.click(choice);
}
export function expectEditorChoice(label: string, name: string) {
  const popup = openEditorSelector(label);
  expect(within(popup).getByRole("button", { name })).toBeInTheDocument();
  fireEvent.keyDown(popup, { key: "Escape" });
}
