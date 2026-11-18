import { evaluateDice } from "./evaluate";
class NeedFace extends Error { constructor(public sides: number) { super("Need a physical die."); } }
/** Replay an immutable tape to request extra physical dice without generating a second outcome. */
export async function evaluatePhysicalDice(formula: string, rollFace: (sides: number) => Promise<number>, signal: AbortSignal) {
  const tape: Array<{ sides: number; value: number }> = [];
  for (let pass = 0; pass <= 100; pass++) {
    if (signal.aborted) throw new Error("Roll cancelled.");
    let index = 0;
    try {
      return evaluateDice(formula, () => 0.5, sides => {
        const face = tape[index++];
        if (!face) throw new NeedFace(sides);
        if (face.sides !== sides) throw new Error("Physical dice sequence changed.");
        return face.value;
      });
    } catch (error) {
      if (!(error instanceof NeedFace)) throw error;
      if (pass === 100) throw new Error("This roll exceeds the 100-die visual budget.");
      tape.push({ sides: error.sides, value: await rollFace(error.sides) });
    }
  }
  throw new Error("Physical dice budget exceeded.");
}
