import { RULER_CELL_COVERAGE_CHOICES, type RulerCellCoverage } from '@core/measurement/cellCoverage';
import { DEFAULT_MOVEMENT_RULES, validMovementRules, type MovementRules } from '@core/movement/types';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';
export const CANVAS_PREFERENCES_KEY = 'combat-zone.canvas-preferences';
export const CANVAS_PREFERENCES_EVENT = 'combat-zone:canvas-preferences';
export type MembershipMethod = 'center' | 'cells' | 'overlap';
export type MembershipDecider = 'cells' | 'nearest' | 'current' | 'ask';
export type CanvasPreferences = {
  rulerCellCoverage: RulerCellCoverage;
  rulerFeel: 'rigid' | 'flexible';
  showRulerArea: boolean;
  rulerColor: string | null;
  rulerOpacity: number;
  showActorMovementDistance: boolean;
  edgeRoutingDuringDrag: "estimates" | "live";
  selectOnUndoRedo: boolean;
  projectIsometricTokens: boolean;
  defaults: MovementRules;
  membership: MembershipMethod;
  fallback: 'center' | 'overlap';
  deciders: MembershipDecider[];
  tracerInvalidRoute: 'reject' | 'detour';
};
export const DEFAULT_CANVAS_PREFERENCES: CanvasPreferences = {
  rulerCellCoverage: 'corners-or-center', rulerFeel: 'rigid', showRulerArea: false, rulerColor: null, rulerOpacity: 1, showActorMovementDistance: true,
  edgeRoutingDuringDrag: "estimates",
  selectOnUndoRedo: false,
  projectIsometricTokens: false,
  defaults: DEFAULT_MOVEMENT_RULES, membership: 'center', fallback: 'center',
  deciders: ['cells', 'nearest', 'current', 'ask'], tracerInvalidRoute: 'reject'
};
let sessionPreferences: CanvasPreferences | undefined;
const clearSessionPreferences = () => { sessionPreferences = undefined; };
globalThis.addEventListener?.(LOCAL_PREFERENCES_RESET_EVENT, clearSessionPreferences);
globalThis.addEventListener?.('storage', (event: Event) => {
  const key = (event as StorageEvent).key;
  if (!key || key === CANVAS_PREFERENCES_KEY) clearSessionPreferences();
});
export function readCanvasPreferences(): CanvasPreferences {
  if (sessionPreferences) return structuredClone(sessionPreferences);
  try {
    const value = JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY) ?? 'null') as Partial<CanvasPreferences> | null;
    return {
      rulerCellCoverage: RULER_CELL_COVERAGE_CHOICES.includes(value?.rulerCellCoverage as RulerCellCoverage) ? value!.rulerCellCoverage! : 'corners-or-center',
      rulerFeel: value?.rulerFeel === 'flexible' ? 'flexible' : 'rigid',
      showRulerArea: value?.showRulerArea === true,
      rulerColor: typeof value?.rulerColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.rulerColor) ? value.rulerColor : null,
      rulerOpacity: typeof value?.rulerOpacity === 'number' && Number.isFinite(value.rulerOpacity) && value.rulerOpacity >= 0 && value.rulerOpacity <= 1 ? value.rulerOpacity : 1,
      showActorMovementDistance: value?.showActorMovementDistance !== false,
      edgeRoutingDuringDrag: value?.edgeRoutingDuringDrag === "live" ? "live" : "estimates",
      selectOnUndoRedo: value?.selectOnUndoRedo === true,
      projectIsometricTokens: value?.projectIsometricTokens === true,
      defaults: validMovementRules(value?.defaults) ? { ...value.defaults } : { ...DEFAULT_MOVEMENT_RULES },
      membership: value?.membership === 'cells' || value?.membership === 'overlap' ? value.membership : 'center',
      fallback: value?.fallback === 'overlap' ? 'overlap' : 'center',
      deciders: Array.isArray(value?.deciders) && value.deciders.length === 4 && new Set(value.deciders).size === 4 && value.deciders.every(d => ['cells', 'nearest', 'current', 'ask'].includes(d)) ? [...value.deciders] : [...DEFAULT_CANVAS_PREFERENCES.deciders],
      tracerInvalidRoute: value?.tracerInvalidRoute === 'detour' ? 'detour' : 'reject'
    };
  } catch { return { ...DEFAULT_CANVAS_PREFERENCES, defaults: { ...DEFAULT_MOVEMENT_RULES }, deciders: [...DEFAULT_CANVAS_PREFERENCES.deciders] }; }
}
export function saveCanvasPreferences(value: CanvasPreferences) {
  try {
    localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify(value));
    sessionPreferences = undefined;
  } catch { sessionPreferences = structuredClone(value); }
  globalThis.dispatchEvent(new CustomEvent(CANVAS_PREFERENCES_EVENT, { detail: value }));
}
