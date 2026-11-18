import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListEditDialog } from "@ui/controls/ListEditDialog";

function Editor({ kind, onSave, onClose }: { kind: string; onSave: () => void; onClose: () => void }) {
  const [items, setItems] = useState([{ id: "first", name: "First" }, { id: "second", name: "Second" }]);
  const [selectedId, select] = useState("first");
  return <ListEditDialog title={`Edit ${kind}`} onSave={onSave} onClose={onClose} onDelete={() => {}}
    selection={{ label: `${kind} to edit`, placeholder: `Select a ${kind}`, items, selectedId, onSelect: select,
      onCreate: () => { setItems([...items, { id: "third", name: "Third" }]); select("third"); },
      createLabel: `Create new ${kind}`, onReorder: ids => setItems(ids.map(id => items.find(item => item.id === id)!)) }}>
    <label>Name<input aria-label="Name" defaultValue="Value" /></label>
  </ListEditDialog>;
}

describe.each(["Rollable", "Counter", "Clock"])("shared %s editor", kind => {
  it("finishes popup selection before keyboard focus moves into editing", async () => {
    const user = userEvent.setup(); const onSave = vi.fn();
    render(<Editor kind={kind} onSave={onSave} onClose={vi.fn()} />);
    const trigger = screen.getByRole("combobox", { name: `${kind} to edit` });
    await user.click(trigger);
    const popup = screen.getByRole("dialog", { name: `${kind} to edit` });
    for (let i = 0; i < 10; i++) { await user.tab(); expect(popup.contains(document.activeElement)).toBe(true); }
    await user.click(within(popup).getByRole("button", { name: "Second" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false"); expect(trigger).toHaveFocus();
    await user.tab(); expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
  it("keeps reordering open and creates through the same popup without submitting", () => {
    const onSave = vi.fn(); render(<Editor kind={kind} onSave={onSave} onClose={vi.fn()} />);
    const trigger = screen.getByRole("combobox", { name: `${kind} to edit` }); fireEvent.click(trigger);
    const popup = screen.getByRole("dialog", { name: `${kind} to edit` });
    fireEvent.click(within(popup).getByRole("button", { name: "Move Second up" }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(popup).getAllByRole("button", { pressed: false })[0]).toHaveTextContent("Second");
    fireEvent.click(within(popup).getByRole("button", { name: "Sort alphabetically" }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(popup).getAllByRole("button").filter(button => button.hasAttribute("aria-pressed")).map(button => button.textContent)).toEqual(["First", "Second"]);
    expect(trigger).toHaveTextContent("First");
    fireEvent.click(within(popup).getByRole("button", { name: `Create new ${kind}` }));
    expect(trigger).toHaveTextContent("Third"); expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onSave).not.toHaveBeenCalled();
  });
  it("Escape dismisses the popup before closing the editor", () => {
    const onClose = vi.fn(); render(<Editor kind={kind} onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("combobox", { name: `${kind} to edit` }));
    fireEvent.keyDown(screen.getByRole("dialog", { name: `${kind} to edit` }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: `Edit ${kind}` })).toBeInTheDocument(); expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Escape" }); expect(onClose).toHaveBeenCalledOnce();
  });
});
