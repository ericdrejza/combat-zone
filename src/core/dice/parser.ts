import { DiceRoller } from "@3d-dice/dice-roller-parser";
import type { RootType } from "@3d-dice/dice-roller-parser/dist/parsedRollTypes";

export type Ast = { type: string; [key: string]: unknown };
export type RepeatAst = Ast & { type: string; cap?: number };
export const REPEATS = new Set(["explode", "compound", "penetrate", "reroll", "rerollOnce"]);
export const DICE_LIMITS = { formula: 2000, depth: 32, nodes: 1000, draws: 10000, cap: 1000, milliseconds: 3000 };

/** Retain lexical modifier order, including dice used in computed counts and sides. */
export function repeatModifiers(root: Ast): RepeatAst[] {
  const found: RepeatAst[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Ast;
    if (node.type === "die") {
      visit(node.count); visit(node.die); visit(node.mods); visit(node.targets); return;
    }
    if (REPEATS.has(node.type)) { found.push(node); visit(node.target); return; }
    Object.values(node).forEach(visit);
  }
  visit(root); return found;
}

/** The upstream grammar accepts arbitrary trailing labels; wrap expressions to demand full consumption. */
export function parseDiceFormula(formula: string): RootType {
  if (!formula.trim() || formula.length > DICE_LIMITS.formula) throw new Error("Enter a formula of at most 2000 characters.");
  let nesting = 0;
  for (const char of formula) {
    if ("({".includes(char) && ++nesting > DICE_LIMITS.depth) throw new Error("Dice formula is too deeply nested.");
    if (")}".includes(char)) nesting--;
  }
  const caps: Array<number | undefined> = [];
  const active = new Map<number, number>();
  let clean = "", index = 0, level = 0, bracket = false;
  while (index < formula.length) {
    const char = formula[index];
    if (char === "[") { bracket = true; active.delete(level); }
    if (char === "]") bracket = false;
    const repeat = !bracket && !/[a-zA-Z]/.test(formula[index - 1] ?? "") && formula.slice(index).match(/^(!!|!p|!|ro|r)/);
    if (repeat) {
      active.set(level, caps.length); caps.push(undefined);
      clean += repeat[0]; index += repeat[0].length; continue;
    }
    if (!bracket && char === "~") {
      const match = formula.slice(index).match(/^~(\d+)/);
      const candidate = active.get(level);
      if (!match || candidate === undefined || caps[candidate] !== undefined) throw new Error("Put ~m immediately after a repeating modifier, for example 3d6!~5.");
      const cap = Number(match[1]);
      if (!Number.isSafeInteger(cap) || cap > DICE_LIMITS.cap) throw new Error("~m must be between 0 and 1000 extra rolls.");
      caps[candidate] = cap; index += match[0].length; continue;
    }
    if (!bracket) {
      if ("({".includes(char)) { level++; active.delete(level); }
      else if (")}".includes(char)) { active.delete(level); level--; }
      else if (/[a-zA-Z+*/%,\s]/.test(char) || char === "-" && !/[!r<>=]/.test(formula[index - 1] ?? "")) active.delete(level);
    }
    clean += char; index++;
  }
  let ast: RootType;
  try { ast = new DiceRoller().parse(`(${clean.trim()})`); }
  catch { throw new Error(`Invalid dice formula: ${formula}`); }
  let nodes = 0;
  function validate(value: unknown, depth: number) {
    if (depth > DICE_LIMITS.depth || ++nodes > DICE_LIMITS.nodes) throw new Error("Dice formula is too complex.");
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) value.forEach(item => validate(item, depth + 1));
    else Object.values(value).forEach(item => validate(item, depth + 1));
  }
  validate(ast, 0);
  repeatModifiers(ast as unknown as Ast).forEach((modifier, i) => { modifier.cap = caps[i] ?? 10; });
  return ast;
}
