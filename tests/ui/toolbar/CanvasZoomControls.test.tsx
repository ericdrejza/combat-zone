import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";

import { store } from "@store/store";
import { CanvasViewportProvider } from "@ui/canvas/CanvasViewportContext";
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "@ui/controls/RepeatButton";
import { CanvasZoomControls } from "@ui/toolbar/CanvasZoomControls";
import { TouchTooltipProvider } from "@ui/toolbar/TouchTooltip";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  return render(<Provider store={store}><CanvasViewportProvider><TouchTooltipProvider><CanvasZoomControls /></TouchTooltipProvider></CanvasViewportProvider></Provider>);
}

it.each([
  ["Zoom in", "110%", "120%", "130%"],
  ["Zoom out", "90%", "80%", "70%"]
])("repeats %s while held without adding a release step", (name, first, second, third) => {
  setup();
  const button = screen.getByRole("button", { name });
  fireEvent.pointerDown(button, { pointerId: 1, button: 0, pointerType: "touch" });
  expect(screen.getByLabelText("Current zoom")).toHaveTextContent(first);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS));
  expect(screen.getByLabelText("Current zoom")).toHaveTextContent(second);
  act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS));
  expect(screen.getByLabelText("Current zoom")).toHaveTextContent(third);
  fireEvent.pointerUp(window, { pointerId: 1 });
  fireEvent.click(button, { detail: 1 });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByLabelText("Current zoom")).toHaveTextContent(third);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it.each([["Zoom in", "400%"], ["Zoom out", "20%"]])("stops %s at its bound", (name, bound) => {
  setup();
  const button = screen.getByRole("button", { name });
  fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
  // Advance separate ticks to allow React to update the disabled state between steps.
  for (let i = 0; i < 40; i++) act(() => vi.advanceTimersByTime(i ? REPEAT_INTERVAL_MS : REPEAT_DELAY_MS));
  expect(screen.getByLabelText("Current zoom")).toHaveTextContent(bound);
  expect(button).toBeDisabled();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByLabelText("Current zoom")).toHaveTextContent(bound);
});

it("keeps fit and reset as single actions", () => {
  setup();
  expect(screen.getByRole("button", { name: "Zoom to fit" })).not.toHaveAttribute("data-press-repeat");
  fireEvent.click(screen.getByRole("button", { name: "More zoom options" }));
  for (const name of ["Zoom to fit width", "Zoom to fit height", "Reset zoom"]) {
    expect(screen.getByRole("button", { name })).not.toHaveAttribute("data-press-repeat");
  }
});
