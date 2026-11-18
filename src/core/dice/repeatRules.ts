import type { Ast, RepeatAst } from "./parser";

type Face = { type: string; roll: number; value: number; valid: boolean; order: number; die?: number; capped?: boolean; explode?: boolean; reroll?: boolean; trace?: Face[] };
/** Isolate the pinned upstream modifier hook; all other grammar/evaluation remains upstream. */
export type ParserHooks = {
  rollType: (ast: Ast) => { value: number };
  reRoll: (face: Face, order: number) => Face;
  applyMod: (faces: Face[], modifier: RepeatAst) => Face[];
};

export function repeatRule(hooks: ParserHooks, faces: Face[], modifier: RepeatAst): Face[] {
  const target = modifier.target as { mod?: string; value: Ast } | undefined;
  const threshold = target ? hooks.rollType(target.value).value : undefined;
  const matches = (face: Face) => {
    const value = threshold ?? (modifier.type.startsWith("reroll") ? 1 : face.die ?? 1);
    return target?.mod === ">" ? face.roll >= value : target?.mod === "<" ? face.roll <= value : face.roll === value;
  };
  const result: Face[] = [];
  for (const initial of faces) {
    let current = initial, extra = 0;
    const chain = [initial];
    const limit = modifier.type === "rerollOnce" ? Math.min(1, modifier.cap ?? 10) : modifier.cap ?? 10;
    while (matches(current) && extra < limit) {
      const next = hooks.reRoll(current, result.length + chain.length);
      if (modifier.type.startsWith("reroll")) { current.reroll = true; current.valid = false; }
      else { current.explode = true; if (modifier.type === "penetrate") next.value -= 1; }
      chain.push(next); current = next; extra++;
    }
    if (matches(current) && extra >= limit && (modifier.type !== "rerollOnce" || limit === 0)) current.capped = true;
    if (modifier.type === "compound") {
      // Preserve each physical face even though the parser treats its sum as one die.
      const combined = { ...initial, value: chain.reduce((sum, face) => sum + face.value, 0), trace: chain.map(face => ({ ...face })) };
      combined.roll = combined.value; combined.capped = current.capped; result.push(combined);
    } else result.push(...chain);
  }
  return result.map((face, order) => ({ ...face, order }));
}
