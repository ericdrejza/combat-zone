import type { DiceNode } from "./types";

export type LabelSubtotal = { label: string; value: number };
type Parts = Map<string | null, number>;
type Contribution = { value: number; parts: Parts };
const EXPRESSIONS = new Set(["expressionroll", "diceexpressionroll", "grouproll", "mathfunction", "expression", "group"]);
function add(left: Parts, right: Parts, scale = 1): Parts {
  const result = new Map(left);
  right.forEach((value, key) => result.set(key, (result.get(key) ?? 0) + value * scale));
  return result;
}
function scale(parts: Parts, factor: number): Parts {
  return new Map(Array.from(parts, ([key, value]) => [key, value * factor]));
}
function hasLabel(parts: Parts) { return Array.from(parts.keys()).some(key => key !== null); }
/** Allocate inseparable operations by contribution magnitude; preserve the exact saved total. */
function proportional(parts: Parts, total: number): Parts {
  const entries = Array.from(parts);
  const weight = entries.reduce((sum, [, value]) => sum + Math.abs(value), 0);
  let remaining = total;
  return new Map(entries.map(([key, value], index) => {
    const portion = index === entries.length - 1 ? remaining : weight ? total * Math.abs(value) / weight : total / entries.length;
    remaining -= portion;
    return [key, portion];
  }));
}
function combine(left: Contribution, right: Contribution, operator: string): Contribution {
  const a = left.value, b = right.value;
  if (operator === "+" || operator === "-") return { value: operator === "+" ? a + b : a - b, parts: add(left.parts, right.parts, operator === "+" ? 1 : -1) };
  if (operator === "*" && !hasLabel(right.parts)) return { value: a * b, parts: scale(left.parts, b) };
  if (operator === "*" && !hasLabel(left.parts)) return { value: a * b, parts: scale(right.parts, a) };
  if (operator === "/" && !hasLabel(right.parts)) return { value: a / b, parts: scale(left.parts, 1 / b) };
  const value = operator === "*" ? a * b : operator === "/" ? a / b : operator === "**" ? a ** b : a % b;
  const weights = !hasLabel(right.parts) && hasLabel(left.parts) ? left.parts
    : !hasLabel(left.parts) && hasLabel(right.parts) ? right.parts
    : add(left.parts, right.parts);
  return { value, parts: proportional(weights, value) };
}

/** Derive final-total contributions from saved results, excluding auxiliary rule calculations. */
export function labelBreakdown(root: DiceNode): LabelSubtotal[] {
  function visit(node: DiceNode): Contribution {
    if (!node.valid || node.dropped) return { value: 0, parts: new Map() };
    // A label owns its complete expression/pool, including nested labels. This
    // avoids counting the same final contribution twice.
    if (node.label) return { value: node.value, parts: new Map([[node.label, node.value]]) };
    const children = node.children?.filter(child => child.valid && !child.dropped);
    if (!children?.length || !EXPRESSIONS.has(node.type)) return { value: node.value, parts: new Map([[null, node.value]]) };
    let result = visit(children[0]);
    for (let index = 1; index < children.length; index++) {
      result = combine(result, visit(children[index]), node.operators?.[index - 1] ?? "+");
    }
    // Functions (and saved group totals) may transform their children's sum.
    if (result.value !== node.value) result = { value: node.value, parts: proportional(result.parts, node.value) };
    return result;
  }
  const parts = visit(root).parts;
  if (!hasLabel(parts) || parts.size < 2) return [];
  const result = new Map<string, number>();
  parts.forEach((value, label) => { if (label !== null) result.set(label, value); });
  if (parts.has(null)) result.set("Other", (result.get("Other") ?? 0) + parts.get(null)!);
  return Array.from(result, ([label, value]) => ({ label, value }));
}
