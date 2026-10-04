import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { RepeatButton, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "@ui/controls/RepeatButton";
import { TouchTooltipProvider } from "@ui/toolbar/TouchTooltip";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); });
function Harness({ maximum = Infinity }: { maximum?: number }) {
  const [value, setValue] = useState(0);
  return <><output aria-label="Value">{value}</output><RepeatButton aria-label="Increase value" title="Increase value" disabled={value >= maximum} onClick={() => setValue(value + 1)}>+</RepeatButton></>;
}
function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)); }

it("steps immediately, repeats after a delay using the latest value, and avoids an extra release click", () => {
  render(<Harness />);
  const button = screen.getByRole("button", { name: "Increase value" });
  expect(button).toHaveAttribute("title", "Increase value (hold to repeat)");
  fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
  expect(screen.getByLabelText("Value")).toHaveTextContent("1");
  advance(REPEAT_DELAY_MS - 1);
  expect(screen.getByLabelText("Value")).toHaveTextContent("1");
  advance(1);
  expect(screen.getByLabelText("Value")).toHaveTextContent("2");
  advance(REPEAT_INTERVAL_MS);
  expect(screen.getByLabelText("Value")).toHaveTextContent("3");
  advance(REPEAT_INTERVAL_MS);
  expect(screen.getByLabelText("Value")).toHaveTextContent("4");
  fireEvent.pointerUp(button, { pointerId: 1 });
  fireEvent.click(button, { detail: 1 });
  advance(1000);
  expect(screen.getByLabelText("Value")).toHaveTextContent("4");
  // Keyboard/programmatic activation remains a normal single click.
  fireEvent.click(button, { detail: 0 });
  expect(screen.getByLabelText("Value")).toHaveTextContent("5");
});
it.each(["leave", "cancel", "blur", "outside release"])("stops repeating on %s", (reason) => {
  const click = vi.fn();
  render(<RepeatButton aria-label="Step" onClick={click}>+</RepeatButton>);
  const button = screen.getByRole("button", { name: "Step" });
  fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
  if (reason === "leave") fireEvent.pointerLeave(button);
  if (reason === "cancel") fireEvent.pointerCancel(button, { pointerId: 1 });
  if (reason === "blur") fireEvent(window, new Event("blur"));
  if (reason === "outside release") fireEvent.pointerUp(window, { pointerId: 1 });
  advance(1000);
  expect(click).toHaveBeenCalledTimes(1);
});
it("stops at a disabled bound and preserves the disabled tooltip", () => {
  render(<Harness maximum={2} />);
  const button = screen.getByRole("button", { name: "Increase value" });
  fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
  advance(REPEAT_DELAY_MS);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("title", "Increase value");
  advance(1000);
  expect(screen.getByLabelText("Value")).toHaveTextContent("2");
});
it("does not start for non-primary buttons and cleans up on unmount", () => {
  const click = vi.fn();
  const view = render(<RepeatButton aria-label="Step" onClick={click}>+</RepeatButton>);
  const button = screen.getByRole("button", { name: "Step" });
  fireEvent.pointerDown(button, { button: 2 });
  advance(1000);
  expect(click).not.toHaveBeenCalled();
  fireEvent.pointerDown(button, { button: 0 });
  expect(click).toHaveBeenCalledTimes(1);
  view.unmount();
  advance(1000);
  expect(click).toHaveBeenCalledTimes(1);
});
it("allows touch hold repetition without a competing touch-hold tooltip", () => {
  render(<TouchTooltipProvider><Harness /></TouchTooltipProvider>);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Increase value" }), { pointerType: "touch", pointerId: 1, button: 0 });
  advance(REPEAT_DELAY_MS);
  advance(REPEAT_INTERVAL_MS);
  advance(REPEAT_INTERVAL_MS);
  expect(screen.getByLabelText("Value")).toHaveTextContent("4");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("keeps touch tooltip reasons available for disabled controls", () => {
  render(<TouchTooltipProvider><RepeatButton disabled title="Maximum reached" aria-label="Increase value">+</RepeatButton></TouchTooltipProvider>);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Increase value" }), { pointerType: "touch", pointerId: 1, button: 0 });
  advance(500);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Maximum reached");
});
