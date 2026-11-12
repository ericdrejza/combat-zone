/** Sender snapshot until shared encounter identities are available. */
export type User = { id: string; name: string; color: string | null };
export type ChatMessage = { id: string; timestamp: number; sender: User; message: string };
