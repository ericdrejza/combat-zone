import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";

import { DEFAULT_ENCOUNTER_PANEL_ORDER, type EncounterPanelOrder } from "@core/encounter/panelLayout";
import { PanelOrderSettings } from "@ui/settings/PanelOrderSettings";

function renderOrder(initial = DEFAULT_ENCOUNTER_PANEL_ORDER) {
  const onChange = vi.fn();
  function Settings() {
    const [order, setOrder] = useState(initial);
    return <PanelOrderSettings order={order} onChange={(next) => {
      onChange(next);
      setOrder(next);
    }} />;
  }
  render(<Settings />);
  return onChange;
}

function titles(side: "left" | "right") {
  return within(screen.getByRole("list", { name: `Default ${side} panel order` }))
    .getAllByRole("listitem").map((item) => item.textContent);
}

const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };

function dragAt(type: "dragOver" | "drop", element: HTMLElement, clientY: number) {
  const event = createEvent[type](element, { dataTransfer });
  Object.defineProperty(event, "clientY", { value: clientY });
  fireEvent(element, event);
}

describe("PanelOrderSettings dragging", () => {
  it("previews and commits positions before and after rows in the same side", () => {
    const onChange = renderOrder();
    const library = screen.getByRole("button", { name: "Reorder Library panel" });
    const log = screen.getByRole("button", { name: "Reorder Log panel" });
    const row = log.parentElement!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ top: 100, height: 40 } as DOMRect);
    fireEvent.dragStart(library, { dataTransfer });
    dragAt("dragOver", row, 110);
    const before = screen.getByLabelText("Drop panel 2 in default left panel order");
    expect(before.firstElementChild).toHaveAttribute("aria-hidden", "false");
    expect(onChange).not.toHaveBeenCalled();
    dragAt("drop", row, 110);
    expect(titles("left")).toEqual(["Properties", "Library", "Log"]);

    fireEvent.dragStart(library, { dataTransfer });
    dragAt("dragOver", row, 135);
    expect(screen.getByLabelText("Drop panel 3 in default left panel order").firstElementChild)
      .toHaveAttribute("aria-hidden", "false");
    dragAt("drop", row, 135);
    expect(titles("left")).toEqual(["Properties", "Log", "Library"]);
  });

  it("allows a panel to be dragged into an empty side", () => {
    const initial: EncounterPanelOrder = {
      left: [], right: [...DEFAULT_ENCOUNTER_PANEL_ORDER.left, ...DEFAULT_ENCOUNTER_PANEL_ORDER.right]
    };
    renderOrder(initial);
    const library = screen.getByRole("button", { name: "Reorder Library panel" });
    const left = screen.getByRole("list", { name: "Default left panel order" });
    fireEvent.dragStart(library, { dataTransfer });
    fireEvent.dragOver(left, { dataTransfer });
    expect(screen.getByLabelText("Drop panel 0 in default left panel order").firstElementChild)
      .toHaveAttribute("aria-hidden", "false");
    fireEvent.drop(left, { dataTransfer });
    expect(titles("left")).toEqual(["Library"]);
  });

  it.each(["mouse", "touch"])("reorders by dragging a name with %s input and clears cancelled previews", (pointerType) => {
    const onChange = renderOrder();
    const audio = screen.getByRole("button", { name: "Reorder Audio panel" });
    const target = screen.getByLabelText("Drop panel 0 in default left panel order");
    const original = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => target);
    const pointer = { button: 0, pointerId: 7, pointerType, isPrimary: true };
    try {
      fireEvent.pointerDown(audio, { ...pointer, clientX: 200, clientY: 200 });
      fireEvent.pointerMove(window, { ...pointer, clientX: 201, clientY: 201 });
      expect(target.firstElementChild).toHaveAttribute("aria-hidden", "true");
      fireEvent.pointerMove(window, { ...pointer, clientX: 100, clientY: 100 });
      expect(target.firstElementChild).toHaveAttribute("aria-hidden", "false");
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.pointerCancel(window, pointer);
      expect(target.firstElementChild).toHaveAttribute("aria-hidden", "true");
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.pointerDown(audio, { ...pointer, clientX: 200, clientY: 200 });
      fireEvent.pointerMove(window, { ...pointer, clientX: 100, clientY: 100 });
      fireEvent.pointerUp(window, { ...pointer, clientX: 100, clientY: 100 });
      expect(titles("left")).toEqual(["Audio", "Library", "Properties", "Log"]);
      expect(titles("right")).toEqual(["Initiative", "Status"]);
      expect(target.firstElementChild).toHaveAttribute("aria-hidden", "true");
    } finally {
      document.elementFromPoint = original;
    }
  });
});
