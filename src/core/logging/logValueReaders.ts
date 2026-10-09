import type { JsonValue } from "@core/history/types";

export function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function stringValues(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function numberValue(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function objectStringValue(
  value: JsonValue | undefined,
  key: string
): string | undefined {
  return value && !Array.isArray(value) && typeof value === "object"
    ? stringValue(value[key])
    : undefined;
}
