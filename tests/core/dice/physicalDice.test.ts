import { describe, it, expect, vi } from "vitest";
import { evaluatePhysicalDice } from "@core/dice/physicalDice";
import { NOTATION_GUIDE } from "@core/dice/notationGuide";
import { evaluateDice } from "@core/dice/evaluate";
import { rollWithPresentation } from "@ui/dice/rollWithPresentation";
import { registerDiceTray } from "@ui/dice/diceTrayBridge";
import { saveDicePresentation } from "@ui/dice/dicePreferences";
describe("presentation parity", () => {
  it("calculates from actual physical faces, including extra rolls", async () => {
    const faces = [6, 2, 4];
    const draw = vi.fn(async () => faces.shift()!);
    const result = await evaluatePhysicalDice("2d6!~2+3", draw, new AbortController().signal);
    expect(result.node.value).toBe(15); expect(draw).toHaveBeenCalledTimes(3);
  });
  it("does not generate a new random outcome for kept physical dice", async () => {
    const faces = [3, 19];
    expect((await evaluatePhysicalDice("2d20kh1+5", async () => faces.shift()!, new AbortController().signal)).node.value).toBe(24);
  });
  it("cancels without rolling more dice", async () => {
    const controller = new AbortController(); controller.abort();
    const draw = vi.fn(); await expect(evaluatePhysicalDice("d6", draw, controller.signal)).rejects.toThrow(/cancelled/);
    expect(draw).not.toHaveBeenCalled();
  });
  it("falls back as a complete transaction with an explanation", async () => {
    saveDicePresentation("3d"); const remove = registerDiceTray(async () => { throw new Error("unsupported die"); });
    try {
      const text = vi.fn(async () => [evaluateDice("d7", () => .5)]);
      const results = await rollWithPresentation(["d7"], new AbortController().signal, text);
      expect(results[0].presentationNote).toContain("unsupported die"); expect(text).toHaveBeenCalledTimes(1);
    } finally { remove(); saveDicePresentation("text"); }
  });
  it.each(NOTATION_GUIDE)("executes the guide example for %s", (_title, formula) => {
    expect(Number.isFinite(evaluateDice(formula, () => .5).node.value)).toBe(true);
  });
});
