import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { EncounterState } from "@core/encounter/types";
import type { EncounterActionRecord, JsonValue } from "@core/history/types";
import type {
  EncounterLogCategory,
  EncounterLogEntry
} from "./types";

type EncounterSnapshots = {
  before: EncounterState;
  after: EncounterState;
};

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringValues(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectStringValue(
  value: JsonValue | undefined,
  key: string
): string | undefined {
  return value && !Array.isArray(value) && typeof value === "object"
    ? stringValue(value[key])
    : undefined;
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "Unknown";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function namesForActorIds(
  actorIds: readonly string[],
  { before, after }: EncounterSnapshots
): string[] {
  return actorIds.map(
    (actorId) =>
      after.actors.byId[actorId]?.name ??
      before.actors.byId[actorId]?.name ??
      actorId
  );
}

function priorNamesForActorIds(
  actorIds: readonly string[],
  { before, after }: EncounterSnapshots
): string[] {
  return actorIds.map(
    (actorId) =>
      before.actors.byId[actorId]?.name ??
      after.actors.byId[actorId]?.name ??
      actorId
  );
}

function namesForZoneIds(
  zoneIds: readonly string[],
  { before, after }: EncounterSnapshots
): string[] {
  return zoneIds.map(
    (zoneId) =>
      after.zones.byId[zoneId]?.name ?? before.zones.byId[zoneId]?.name ?? zoneId
  );
}

function actorIdsFrom(action: EncounterActionRecord): string[] {
  const ids = stringValues(action.payload.actorIds);
  const actorId = stringValue(action.payload.actorId);
  return ids.length > 0 ? ids : actorId ? [actorId] : [];
}

function zoneIdsFrom(action: EncounterActionRecord): string[] {
  const ids = stringValues(action.payload.zoneIds);
  const zoneId = stringValue(action.payload.zoneId);
  return ids.length > 0 ? ids : zoneId ? [zoneId] : [];
}

export function getEncounterLogCategory(
  actionType: string
): EncounterLogCategory {
  const prefix = actionType.split(".")[0];
  switch (prefix) {
    case "actor":
    case "zone":
    case "engagement":
    case "edge":
    case "annotation":
    case "initiative":
    case "background":
      return prefix;
    default:
      return "encounter";
  }
}

function destinationName(
  action: EncounterActionRecord,
  snapshots: EncounterSnapshots
): string {
  const firstMovedActorId = actorIdsFrom(action)[0];
  const destinationZoneId =
    stringValue(action.payload.destinationZoneId) ??
    (firstMovedActorId
      ? snapshots.after.actors.byId[firstMovedActorId]?.currentZoneId
      : undefined);
  if (!destinationZoneId || destinationZoneId === ZONELESS_ACTOR_ZONE_ID) {
    return "the zoneless area";
  }
  const zoneName = namesForZoneIds([destinationZoneId], snapshots)[0];
  return `the ${zoneName}`;
}

function engagementActorIds(
  action: EncounterActionRecord,
  { before, after }: EncounterSnapshots
): string[] {
  const payloadIds = [
    ...stringValues(action.payload.participantIds),
    ...actorIdsFrom(action)
  ];
  if (payloadIds.length > 0) return [...new Set(payloadIds)];

  const targetId = stringValue(action.payload.targetEngagementId);
  const sourceId = stringValue(action.payload.sourceEngagementId);
  return [...new Set(
    [sourceId, targetId].flatMap((engagementId) =>
      engagementId
        ? after.engagements.byId[engagementId]?.participantIds ??
          before.engagements.byId[engagementId]?.participantIds ??
          []
        : []
    )
  )];
}

function changedPropertyNames(action: EncounterActionRecord): string[] {
  const properties = action.payload.properties;
  return properties && !Array.isArray(properties) && typeof properties === "object"
    ? Object.keys(properties)
    : [];
}

/** Converts a committed domain action into concise, user-facing audit text. */
export function formatCommittedEncounterAction(
  action: EncounterActionRecord,
  snapshots: EncounterSnapshots
): string {
  const actorNames = () => listNames(namesForActorIds(actorIdsFrom(action), snapshots));
  const zoneNames = () => listNames(namesForZoneIds(zoneIdsFrom(action), snapshots));

  switch (action.type) {
    case "actor.create":
      return `${actorNames()} added to ${destinationName(action, snapshots)}.`;
    case "actor.move":
    case "actor.moveMany":
      return `${actorNames()} moved to ${destinationName(action, snapshots)}.`;
    case "actor.delete":
      return `${actorNames()} deleted.`;
    case "actor.duplicate": {
      const duplicateId = stringValue(action.payload.duplicateActorId);
      const duplicateName = duplicateId
        ? namesForActorIds([duplicateId], snapshots)[0]
        : "a new actor";
      return `${actorNames()} duplicated as ${duplicateName}.`;
    }
    case "actor.renameMany":
      return `${listNames(priorNamesForActorIds(actorIdsFrom(action), snapshots))} renamed to ${stringValue(action.payload.name) ?? actorNames()}.`;
    case "actor.paint":
    case "actor.updateProperties": {
      const propertyNames = changedPropertyNames(action);
      const details = propertyNames.length > 0 ? `: ${listNames(propertyNames)}` : "";
      return `Updated ${actorNames()}${details}.`;
    }
    case "zone.create":
      return zoneIdsFrom(action).length > 0
        ? `${zoneNames()} created.`
        : "Zone creation requested.";
    case "zone.delete":
      return `${zoneNames()} deleted.`;
    case "zone.move":
      return `${zoneNames()} moved.`;
    case "zone.reshape":
      return `${zoneNames()} reshaped.`;
    case "zone.updateProperties": {
      const propertyNames = changedPropertyNames(action);
      const details = propertyNames.length > 0 ? `: ${listNames(propertyNames)}` : "";
      return `Updated ${zoneNames()}${details}.`;
    }
    case "zone.paintColors": {
      const targetIds = [
        ...stringValues(action.payload.targetZoneIds),
        ...zoneIdsFrom(action)
      ];
      const targets = listNames(
        namesForZoneIds([...new Set(targetIds)], snapshots)
      );
      return `Painted ${targets}.`;
    }
    case "zone.exportProperties": {
      const targetIds = stringValues(action.payload.targetZoneIds);
      const targets = listNames(namesForZoneIds(targetIds, snapshots));
      return `Copied zone properties to ${targets}.`;
    }
    case "engagement.create":
    case "engagement.groupSelected":
      return `${listNames(namesForActorIds(engagementActorIds(action, snapshots), snapshots))} engaged.`;
    case "engagement.join":
      return `${listNames(namesForActorIds(engagementActorIds(action, snapshots), snapshots))} joined an engagement.`;
    case "engagement.merge":
      return `${listNames(namesForActorIds(engagementActorIds(action, snapshots), snapshots))} merged into one engagement.`;
    case "engagement.leaveSelected":
      return `${actorNames()} disengaged.`;
    case "engagement.moveZone":
      return `${listNames(namesForActorIds(engagementActorIds(action, snapshots), snapshots))} moved to ${destinationName(action, snapshots)}.`;
    case "engagement.update":
      return `Updated the engagement for ${listNames(namesForActorIds(engagementActorIds(action, snapshots), snapshots))}${changedPropertyNames(action).length > 0 ? `: ${listNames(changedPropertyNames(action))}` : ""}.`;
    case "background.add": {
      const name =
        objectStringValue(action.payload.backgroundImage, "name") ??
        snapshots.after.backgroundImage?.name;
      return name ? `${name} added as the background.` : "Background added.";
    }
    case "background.replace": {
      const name =
        objectStringValue(action.payload.backgroundImage, "name") ??
        snapshots.after.backgroundImage?.name;
      return name ? `Background replaced with ${name}.` : "Background replaced.";
    }
    case "background.delete": {
      const name =
        stringValue(action.payload.backgroundImageName) ??
        snapshots.before.backgroundImage?.name;
      return name ? `${name} background deleted.` : "Background deleted.";
    }
    default:
      return `${action.type} committed.`;
  }
}

export function createCommittedEncounterLogEntry(
  action: EncounterActionRecord,
  snapshots: EncounterSnapshots
): EncounterLogEntry {
  return {
    actionId: action.id,
    actionType: action.type,
    category: getEncounterLogCategory(action.type),
    id: `${action.id}:commit`,
    kind: "commit",
    message: formatCommittedEncounterAction(action, snapshots),
    timestamp: action.timestamp
  };
}

/** Validation failures are logged only at the point the caller rejects them. */
export function createValidationBlockLogEntry(
  action: EncounterActionRecord,
  encounter: EncounterState
): EncounterLogEntry {
  const reasons = action.validationResult?.messages.map(({ message }) => message) ?? [];
  const attemptedMessage = formatCommittedEncounterAction(action, {
    after: encounter,
    before: encounter
  });
  return {
    actionId: action.id,
    actionType: action.type,
    category: "validation",
    id: `${action.id}:validation-block`,
    kind: "validation-block",
    message: `Blocked action: ${attemptedMessage}${reasons.length > 0 ? ` ${reasons.join(" ")}` : ""}`,
    timestamp: action.timestamp
  };
}
