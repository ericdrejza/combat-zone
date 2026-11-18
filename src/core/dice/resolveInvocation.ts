import type { EncounterState } from "@core/encounter/types";
import type { RollInvocation } from "./types";

export type MentionBindings = Record<string, string>;
export { AmbiguousMentionError } from "./references";
import { chooseMention, resolveEntityReference } from "./references";
import { splitReference as split, referenceName as name, formatReferenceName } from "./referenceSyntax";
export function invocationNames(message: string) {
  const sections = split(message, "->");
  if (sections.length > 2) throw new Error("Supply one target or one target list after ->.");
  const source = split(sections[0].trim(), "/");
  if (source.length !== 2) throw new Error("Use @actor/Rollable -> @target or -> [@actor1, @actor2].");
  const targetText = sections[1]?.trim();
  const targets = !targetText ? [] : targetText.startsWith("[") && targetText.endsWith("]") ? split(targetText.slice(1, -1), ",").map(t => t.trim()) : [targetText];
  return { actor: source[0].trim(), rollable: name(source[1]), targets };
}
export function resolveInvocation(state: EncounterState, message: string, bindings: MentionBindings = {}): RollInvocation {
  const names = invocationNames(message);
  const source = resolveEntityReference(state, names.actor, "source", bindings);
  if (source.actorIds.length !== 1) throw new Error("Choose one actor to launch a Rollable.");
  const actor = state.actors.byId[source.actorIds[0]];
  const rollable = chooseMention((actor.rollables?.allIds ?? []).map(id => actor.rollables!.byId[id]), names.rollable, "rollable", bindings);
  if (!rollable.effectFormula.trim()) throw new Error("Rollables require an effect roll.");
  const targets = names.targets.flatMap((n, i) => {
    const reference = resolveEntityReference(state, n, `target:${i}`, bindings);
    if (!reference.actorIds.length) throw new Error(`No matching targets: ${n}`);
    return reference.actorIds;
  }).map(id => ({ id, name: state.actors.byId[id].name }));
  return { actorId: actor.id, actorName: actor.name, rollable: structuredClone(rollable), checkRollMode: "shared", targets: targets.filter((t, i) => targets.findIndex(v => v.id === t.id) === i), decisions: {}, phase: rollable.checkFormula && rollable.effectFormula ? "pending" : "resolved" };
}
export function invocationText(actor: string, rollable: string) { return `@${formatReferenceName(actor)}/${formatReferenceName(rollable)}`; }
