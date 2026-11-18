export type CheckRollMode = "shared" | "perTarget";
export type CheckRollSetting = CheckRollMode | "ask";
/** Stable application format: no parser instances or renderer state enter saved documents. */
export type DiceNode = {
  type: string; value: number; valid: boolean; label?: string; face?: number;
  sides?: number; dropped?: boolean; exploded?: boolean; rerolled?: boolean;
  critical?: "success" | "failure"; matched?: boolean; capped?: boolean;
  parameters?: { count?: DiceNode; sides?: DiceNode };
  children?: DiceNode[]; operators?: string[];
};
export type DiceResult = {
  id: string; formula: string; role?: "check" | "effect"; outcome: "sum" | "successes" | "matches";
  /** Independent checks reference the invocation snapshot, even after an Actor is deleted. */
  targetId?: string;
  node: DiceNode; auxiliary?: DiceNode[]; capped: boolean; presentationNote?: string;
};
export type Rollable = {
  id: string; name: string; checkFormula: string; effectFormula: string; checkRollMode: CheckRollSetting;
  effectKind: "damage" | "healing" | "none"; audioGroupId: string | null;
};
export type RollInvocation = {
  actorId: string; actorName: string; rollable: Rollable;
  /** The actual choice is durable when the saved Rollable setting is Ask me. */
  checkRollMode: CheckRollMode;
  targets: Array<{ id: string; name: string }>;
  decisions: Record<string, "hit" | "miss">;
  phase: "pending" | "resolved";
};
export type RollApplication = {
  id: string; resultId: string; actorId: string; kind: "damage" | "healing"; amount: number;
};
