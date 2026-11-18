import type { ActorLayoutGroup } from "@entities/actor/types";

export class AmbiguousMentionError extends Error {
  constructor(public key: string, public choices: Array<{ id: string; name: string; detail?: string }>) { super("Choose which actor, zone, or Rollable you mean."); }
}
export function chooseMention<T extends { id: string; name: string }>(entries: T[], input: string, key: string, bindings: Record<string, string> = {}): T {
  const matches = entries.filter(e => e.name.toLocaleLowerCase() === input.toLocaleLowerCase());
  const selected = matches.find(e => e.id === bindings[key]);
  if (selected) return selected;
  if (!matches.length) throw new Error(`No matching actor, zone, or Rollable: ${input}`);
  if (matches.length > 1) throw new AmbiguousMentionError(key, matches);
  return matches[0];
}
export const FACTION_REFERENCES: Array<{ name: string; group: ActorLayoutGroup }> = [
  { name: "heroes", group: "hero" }, { name: "allies", group: "ally" },
  { name: "enemies", group: "enemy" }, { name: "neutrals", group: "neutral" }
];
