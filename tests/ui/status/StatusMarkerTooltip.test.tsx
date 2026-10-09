import { act, fireEvent, render, screen } from "@testing-library/react";
import { Shield } from "lucide-react";
import { StatusMarkerToggle } from "@ui/status/StatusMarkerToggle";
import { TouchTooltipProvider } from "@ui/toolbar/TouchTooltip";

function setup(disabled = false) {
  return render(<TouchTooltipProvider><StatusMarkerToggle label="Guarded" tooltip="Guarded help" Icon={Shield} pressed={false} disabled={disabled} onClick={() => {}} /></TouchTooltipProvider>);
}

it("shows mouse hover help immediately and dismisses it on leave", () => {
  setup();
  const button = screen.getByRole("button", { name: "Guarded" });
  fireEvent.pointerEnter(button, { pointerType: "mouse" });
  expect(screen.getByRole("tooltip")).toHaveTextContent("Guarded help");
  expect(button).toHaveAccessibleDescription("Guarded help");
  expect(button).not.toHaveAttribute("title");
  fireEvent.pointerLeave(button, { pointerType: "mouse" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("shows keyboard focus help immediately and supports Escape and blur", () => {
  setup();
  const button = screen.getByRole("button", { name: "Guarded" });
  act(() => button.focus());
  expect(screen.getByRole("tooltip")).toHaveTextContent("Guarded help");
  fireEvent.keyDown(button, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  act(() => { button.blur(); button.focus(); });
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  act(() => button.blur());
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("shows disabled-control help on hover", () => {
  setup(true);
  fireEvent.pointerEnter(screen.getByRole("button"), { pointerType: "mouse" });
  expect(screen.getByRole("tooltip")).toHaveTextContent("Guarded help");
});

it("preserves delayed touch help without showing hover help on touch entry", () => {
  vi.useFakeTimers();
  try {
    setup();
    const button = screen.getByRole("button");
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.pointerDown(button, { pointerType: "touch", pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    act(() => vi.advanceTimersByTime(499));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Guarded help");
    fireEvent.pointerUp(button, { pointerType: "touch", pointerId: 1 });
  } finally { vi.useRealTimers(); }
});
