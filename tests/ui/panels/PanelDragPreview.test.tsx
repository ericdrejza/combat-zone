import { fireEvent, screen } from "@testing-library/react";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

it("returns the pointer preview home over the canvas and restores a revisited target", () => {
  renderApp();
  const handle = screen.getByRole("button", { name: "Reorder Status panel" });
  const destination = screen.getByLabelText("Drop panel 0 in left docked panels");
  const origin = screen.getByLabelText("Drop panel 1 in right docked panels");
  const canvas = screen.getByRole("main", { name: "Encounter canvas" });
  const before = store.getState().encounter;
  const originalHitTest = document.elementFromPoint;
  let hovered: Element = destination;
  document.elementFromPoint = vi.fn(() => hovered);
  const move = () => fireEvent.pointerMove(window, { clientX: 100, clientY: 100, pointerId: 1 });
  try {
    fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    move();
    expect(destination.firstElementChild).toHaveAttribute("aria-hidden", "false");
    hovered = canvas;
    move();
    expect(destination.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(origin.firstElementChild).toHaveAttribute("aria-hidden", "false");
    hovered = destination;
    move();
    expect(destination.firstElementChild).toHaveAttribute("aria-hidden", "false");
    expect(origin.firstElementChild).toHaveAttribute("aria-hidden", "true");
    hovered = canvas;
    move();
    fireEvent.pointerUp(window, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(store.getState().encounter).toBe(before);
    expect(origin.firstElementChild).toHaveAttribute("aria-hidden", "true");
  } finally {
    document.elementFromPoint = originalHitTest;
  }
});

it("returns native drag previews home when hovering the canvas", () => {
  renderApp();
  const handle = screen.getByRole("button", { name: "Reorder Status panel" });
  const destination = screen.getByLabelText("Drop panel 0 in left docked panels");
  const origin = screen.getByLabelText("Drop panel 1 in right docked panels");
  const before = store.getState().encounter;
  const dataTransfer = { effectAllowed: "", setData() {} };
  fireEvent.dragStart(handle, { dataTransfer });
  fireEvent.dragOver(destination, { dataTransfer });
  expect(destination.firstElementChild).toHaveAttribute("aria-hidden", "false");
  fireEvent.dragOver(screen.getByRole("main", { name: "Encounter canvas" }), { dataTransfer });
  expect(destination.firstElementChild).toHaveAttribute("aria-hidden", "true");
  expect(origin.firstElementChild).toHaveAttribute("aria-hidden", "false");
  fireEvent.dragEnd(handle);
  expect(store.getState().encounter).toBe(before);
  expect(origin.firstElementChild).toHaveAttribute("aria-hidden", "true");
});
