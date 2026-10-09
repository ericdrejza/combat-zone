import { describe, expect, it } from "vitest";
import { counterSwipeAction } from "@ui/panels/status_panel/SwipeCounterRow";

describe("counter swipe actions", () => {
  it("deletes to the right and edits to the left after the distance threshold", () => {
    expect(counterSwipeAction(72, 0, 400)).toBe("delete");
    expect(counterSwipeAction(-72, 0, 400)).toBe("edit");
    expect(counterSwipeAction(60, 0, 200)).toBe("delete");
    expect(counterSwipeAction(59, 0, 200)).toBeNull();
  });
  it("accepts intentional fast flicks in either direction", () => {
    expect(counterSwipeAction(20, 500, 400)).toBe("delete");
    expect(counterSwipeAction(-20, -500, 400)).toBe("edit");
  });
  it("rejects small, slow, or reversing flicks", () => {
    expect(counterSwipeAction(19, 1000, 400)).toBeNull();
    expect(counterSwipeAction(30, 499, 400)).toBeNull();
    expect(counterSwipeAction(30, -1000, 400)).toBeNull();
    expect(counterSwipeAction(0, 0, 400)).toBeNull();
  });
});
