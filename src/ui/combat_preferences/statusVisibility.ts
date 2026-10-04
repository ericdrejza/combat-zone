/** Display preferences never remove conditions or equipment from actors. */
export type StatusVisibility = { hiddenConditions: string[]; showConditions: boolean; showWeapons: boolean; showArmor: boolean };
export const DEFAULT_STATUS_VISIBILITY: StatusVisibility = { hiddenConditions: [], showConditions: true, showWeapons: true, showArmor: true };
export function normalizeStatusVisibility(input: unknown): StatusVisibility {
  if (!input || typeof input !== "object") return { ...DEFAULT_STATUS_VISIBILITY };
  const value = input as Partial<StatusVisibility>;
  return {
    hiddenConditions: Array.isArray(value.hiddenConditions) ? [...new Set(value.hiddenConditions.filter((id): id is string => typeof id === "string"))] : [],
    showConditions: value.showConditions !== false,
    showWeapons: value.showWeapons !== false,
    showArmor: value.showArmor !== false
  };
}
