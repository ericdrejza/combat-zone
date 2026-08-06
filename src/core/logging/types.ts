export type EncounterLogCategory =
  | "actor"
  | "zone"
  | "engagement"
  | "edge"
  | "annotation"
  | "initiative"
  | "background"
  | "encounter"
  | "validation";

export type EncounterLogEntryKind = "commit" | "history" | "validation-block";

/** Serializable audit entry kept outside encounter history. */
export type EncounterLogEntry = {
  id: string;
  timestamp: number;
  category: EncounterLogCategory;
  kind: EncounterLogEntryKind;
  message: string;
  actionId: string;
  actionType: string;
};

export type EncounterLogState = {
  entries: EncounterLogEntry[];
};
