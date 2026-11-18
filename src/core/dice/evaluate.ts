import { DiceRoller } from "@3d-dice/dice-roller-parser";
import { DICE_LIMITS, parseDiceFormula, REPEATS, type RepeatAst } from "./parser";
import { repeatRule, type ParserHooks } from "./repeatRules";
import type { DiceNode, DiceResult } from "./types";

type Raw = { successes?: number; failures?: number; success?: boolean | null; order?: number; type: string; value: number; valid: boolean; label?: string; roll?: number; die?: number | Raw; dice?: Raw[]; rolls?: Raw[]; trace?: Raw[]; count?: Raw; expr?: Raw; ops?: string[]; op?: string; drop?: boolean; explode?: boolean; reroll?: boolean; critical?: "success" | "failure" | null; matched?: boolean; capped?: boolean };

function normalize(raw: Raw): DiceNode {
  if (!Number.isFinite(raw.value)) throw new Error("The formula produced a non-finite result.");
  const children = raw.trace ?? raw.dice ?? raw.rolls ?? (raw.expr ? [raw.expr] : []);
  const count = raw.count && raw.count.type !== "number" ? normalize(raw.count) : undefined;
  const sides = raw.die && typeof raw.die !== "number" && raw.die.type !== "number" && raw.die.type !== "fate" ? normalize(raw.die) : undefined;
  return { ...(count || sides ? { parameters: { ...(count ? { count } : {}), ...(sides ? { sides } : {}) } } : {}), type: raw.type, value: raw.value, valid: raw.valid,
    ...(raw.label ? { label: raw.label } : {}),
    ...(raw.roll !== undefined ? { face: raw.roll, sides: typeof raw.die === "number" ? raw.die : 3 } : {}),
    ...(raw.drop ? { dropped: true } : {}), ...(raw.explode ? { exploded: true } : {}),
    ...(raw.reroll ? { rerolled: true } : {}), ...(raw.capped ? { capped: true } : {}),
    ...(raw.critical ? { critical: raw.critical } : {}), ...(raw.matched ? { matched: true } : {}),
    ...(children.length ? { children: children.map(normalize) } : {}),
    ...(raw.ops ? { operators: raw.ops } : raw.op ? { operators: [raw.op] } : {}) };
}

/** Randomness is injected for repeatable tests; global draw/deadline budgets cover computed dice too. */
export function evaluateDice(formula: string, random = Math.random, faceProvider?: (sides: number) => number): DiceResult {
  const ast = parseDiceFormula(formula);
  const pools: Raw[] = [];
  let draws = 0;
  const start = Date.now();
  const roller = new DiceRoller(() => {
    if (++draws > DICE_LIMITS.draws || Date.now() - start > DICE_LIMITS.milliseconds) throw new Error("Roll exceeded the execution budget. Reduce the dice or ~m cap.");
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("Invalid dice random source.");
    return value;
  }, DICE_LIMITS.draws);
  // Version 0.2.6 rounds random draws, which can produce sides+1. Keep physical
  // face generation uniform and range-safe at this adapter boundary.
  const internals = roller as unknown as {
    generateDiceRoll: (sides: number, order: number) => Raw;
    rollDie: (ast: Record<string, unknown>) => Raw;
    rollType: (ast: Record<string, unknown>) => Raw;
  };
  internals.generateDiceRoll = (sides, order) => {
    const draw = roller.randFunction();
    const face = faceProvider ? faceProvider(sides) : Math.floor(draw * sides) + 1;
    if (!Number.isSafeInteger(face) || face < 1 || face > sides) throw new Error("Invalid physical die result.");
    return { type: "roll", die: sides, roll: face, value: face, valid: true, order, successes: 0, failures: 0, success: null, matched: false,
      critical: face === sides ? "success" : face === 1 ? "failure" : null };
  };
  const rollDie = internals.rollDie.bind(roller);
  internals.rollDie = input => {
    const count = internals.rollType(input.count as Record<string, unknown>);
    const dieAst = input.die as Record<string, unknown>;
    const sides = dieAst.type === "fate" ? null : internals.rollType(dieAst);
    if (sides) sides.value = Number(sides.value);
    if (!Number.isSafeInteger(count.value) || count.value < 1 || count.value > DICE_LIMITS.draws ||
      sides && (!Number.isSafeInteger(sides.value) || sides.value < 1 || sides.value > 1000000000)) throw new Error("Dice counts and sides must be positive whole numbers within the execution budget.");
    const number = (value: number) => ({ type: "number", value });
    const result = rollDie({ ...input, count: number(count.value), die: sides ? number(sides.value) : dieAst });
    result.count = count;
    if (sides) result.die = sides;
    pools.push(result);
    return result;
  };
  const hooks = roller as unknown as ParserHooks;
  const apply = hooks.applyMod.bind(roller);
  hooks.applyMod = (faces, modifier: RepeatAst) => REPEATS.has(modifier.type) ? repeatRule(hooks, faces, modifier) : apply(faces, modifier);
  const raw = roller.rollParsed(ast) as Raw;
  const node = normalize(raw);
  const seen = new Set<Raw>();
  const representedPools = new Set<Raw[]>();
  function mark(value: Raw) {
    if (seen.has(value)) return;
    seen.add(value);
    if (value.rolls) representedPools.add(value.rolls);
    [...(value.dice ?? []), ...(value.rolls ?? []), ...(value.trace ?? []), ...(value.expr ? [value.expr] : []), ...(value.count ? [value.count] : []), ...(value.die && typeof value.die !== "number" ? [value.die] : [])].forEach(mark);
  }
  mark(raw);
  // Upstream omits dice used to compute modifier thresholds/keep counts from
  // its result tree. Retain those calculations so every generated face is visible.
  const auxiliary: DiceNode[] = [];
  for (const pool of [...pools].reverse()) if (!seen.has(pool) && (!pool.rolls || !representedPools.has(pool.rolls))) { auxiliary.unshift(normalize(pool)); mark(pool); }
  const any = (n: DiceNode): boolean => !!n.capped || !!n.children?.some(any) || !!n.parameters?.count && any(n.parameters.count) || !!n.parameters?.sides && any(n.parameters.sides);
  function outcome(value: unknown): DiceResult["outcome"] {
    if (!value || typeof value !== "object") return "sum";
    const obj = value as Record<string, unknown>;
    if (obj.type === "match" && obj.count) return "matches";
    if (obj.type === "success" || obj.type === "failure") return "successes";
    return Object.values(obj).map(outcome).find(kind => kind !== "sum") ?? "sum";
  }
  return { id: crypto.randomUUID(), formula, node, ...(auxiliary.length ? { auxiliary } : {}), capped: any(node) || auxiliary.some(any), outcome: outcome(ast) };
}
