/** Historical display spans; entity IDs identify the selection without requiring the entity to survive. */
export type ChatReference = { start: number; end: number; entityId: string; kind: "actor" | "zone"; color: string | null };
/** Sender snapshot until shared encounter identities are available. */
export const LOCAL_CHAT_SENDER_ID = "game-master";
export type User = { id: string; name: string; color: string | null };
export type ChatMessage = { id: string; timestamp: number; sender: User; message: string; references?: ChatReference[]; rolls?: import("@core/dice/types").DiceResult[]; invocation?: import("@core/dice/types").RollInvocation };
