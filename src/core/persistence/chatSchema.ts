import { PersistenceValidationError } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/** Reject malformed sender snapshots and collection references before hydration. */
export function assertChatMessages(value: unknown): void {
  const fail = () => { throw new PersistenceValidationError("Encounter chat messages are invalid."); };
  if (!record(value) || !record(value.byId) || !Array.isArray(value.allIds)) return fail();
  const ids = value.allIds;
  if (new Set(ids).size !== ids.length || Object.keys(value.byId).length !== ids.length) return fail();
  for (const id of ids) {
    if (typeof id !== "string" || !id) return fail();
    const entry = value.byId[id];
    if (!record(entry) || entry.id !== id || !nonempty(entry.message) ||
      typeof entry.timestamp !== "number" || !Number.isFinite(entry.timestamp) ||
      !record(entry.sender) || !nonempty(entry.sender.id) || !nonempty(entry.sender.name) ||
      !(entry.sender.color === null || (typeof entry.sender.color === "string" && /^#[0-9a-f]{6}$/i.test(entry.sender.color)))) return fail();
  }
}
