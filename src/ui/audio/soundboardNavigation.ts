export type SoundboardEntityTarget = { entityId: string; entityType: "actor" | "zone" };
export type SoundboardNavigationRequest = SoundboardEntityTarget & { requestId: number };
