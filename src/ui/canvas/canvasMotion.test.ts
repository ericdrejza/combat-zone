import {
  CANVAS_SPRING_TRANSITION,
  DIRECT_MANIPULATION_TRANSITION,
  getCanvasTransition
} from "./canvasMotion";

describe("canvas Motion transition policy", () => {
  it("uses the approved spring for automatic movement", () => {
    expect(getCanvasTransition(false, false)).toBe(
      CANVAS_SPRING_TRANSITION
    );
  });

  it("makes direct manipulation and reduced motion immediate", () => {
    expect(getCanvasTransition(true, false)).toBe(
      DIRECT_MANIPULATION_TRANSITION
    );
    expect(getCanvasTransition(false, true)).toBe(
      DIRECT_MANIPULATION_TRANSITION
    );
  });
});
