import { act, fireEvent, render, screen } from "@testing-library/react";

import { buildZone } from "@entities/zone/zoneMutations";
import { ZoneShapeSection } from "@ui/panels/zone_properties/ZoneShapeSection";
import { TouchTooltipProvider } from "@ui/toolbar/TouchTooltip";

const zone = buildZone({ id: "help-zone", shape: "polygon", polygon: [
  { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }
] });

afterEach(() => vi.useRealTimers());

it("exposes editing help only for Polygon, with keyboard focus and Escape dismissal", () => {
  const onConvert = vi.fn();
  const view = render(<ZoneShapeSection zone={zone} onConvert={onConvert} />);
  const help = screen.getByRole("button", { name: "Polygon editing help" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.focus(help);
  expect(screen.getByRole("tooltip")).toHaveAttribute("id", help.getAttribute("aria-describedby"));
  fireEvent.keyDown(help, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(onConvert).not.toHaveBeenCalled();
  view.rerender(<ZoneShapeSection zone={{ ...zone, shape: "rectangle" }} onConvert={onConvert} />);
  expect(screen.queryByRole("button", { name: "Polygon editing help" })).not.toBeInTheDocument();
});

it("shows Polygon editing help on touch hold without converting the shape", () => {
  vi.useFakeTimers();
  const onConvert = vi.fn();
  render(<TouchTooltipProvider><ZoneShapeSection zone={zone} onConvert={onConvert} /></TouchTooltipProvider>);
  const help = screen.getByRole("button", { name: "Polygon editing help" });
  fireEvent.pointerDown(help, { button: 0, pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.pointerUp(help, { pointerId: 1, pointerType: "touch" });
  fireEvent.click(help);
  expect(onConvert).not.toHaveBeenCalled();
});
