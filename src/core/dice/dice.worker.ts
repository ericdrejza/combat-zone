import { evaluateDice } from "./evaluate";
import { parseDiceFormula } from "./parser";

self.onmessage = (event: MessageEvent<string[]>) => {
  try {
    event.data.forEach(parseDiceFormula);
    self.postMessage({ results: event.data.map(formula => evaluateDice(formula)) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Dice roll failed." }); }
};
