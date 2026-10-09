import { render, screen } from "@testing-library/react";
import { ClockDisplay } from "@ui/panels/status_panel/ClockDisplay";

describe.each(["stack", "row"] as const)("%s clock", (style) => {
  it.each([1, 4, 12])("renders all %s segments and describes progress", (segments) => {
    const view = render(<ClockDisplay style={style} name="Alarm" value={0} segments={segments} />);
    expect(screen.getByRole("img", { name: `Alarm: 0 of ${segments} segments filled` }).querySelectorAll("rect")).toHaveLength(segments);
    view.rerender(<ClockDisplay style={style} name="Alarm" value={segments} segments={segments} />);
    expect(screen.getByRole("img", { name: `Alarm: ${segments} of ${segments} segments filled` }).querySelectorAll("rect")).toHaveLength(segments);
  });
  it("orders progress upward for Stack and rightward for Row", () => {
    render(<ClockDisplay style={style} name="Alarm" value={1} segments={4} />);
    const boxes = Array.from(screen.getByRole("img").querySelectorAll("rect"));
    const coordinate = style === "stack" ? "y" : "x";
    const positions = boxes.map((box) => Number(box.getAttribute(coordinate)));
    expect(positions).toEqual([...positions].sort((a, b) => style === "stack" ? b - a : a - b));
  });
});
