import { fireEvent, render, screen } from "@testing-library/react";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { DEFAULT_COMBAT_RULES, type CombatRules } from "@entities/actor/actorResources";
import { CombatPreferenceProvider, COMBAT_PREFERENCES_STORAGE_KEY } from "@ui/combat_preferences/CombatPreferenceProvider";
import { HitPointControls } from "@ui/panels/status_panel/HitPointControls";

function actor(id: string, current?: number) {
  const actor = createActor(createEncounterState({ id: "limits", name: "Limits" }), { id, name: id, currentZoneId: "zoneless" }).actors.byId[id];
  if (current !== undefined) actor.hitPoints = { current, maximum: 20 };
  return actor;
}
function setup(limits: CombatRules["limits"], currents: Array<number | undefined>) {
  localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...DEFAULT_COMBAT_RULES, limits }));
  const onAdjust = vi.fn();
  render(<CombatPreferenceProvider><HitPointControls actors={currents.map((current, index) => actor(String(index), current))} label="Hit points" disabled={false} onAdjust={onAdjust} onSet={vi.fn()} /></CombatPreferenceProvider>);
  return onAdjust;
}
afterEach(() => localStorage.removeItem(COMBAT_PREFERENCES_STORAGE_KEY));

describe("hit point action limits", () => {
  it.each(["bounded", "negative", "unbounded"] as const)("respects %s minimum limits", (limits) => {
    const onAdjust = setup(limits, [0]);
    const damage = screen.getByRole("button", { name: "Apply damage" });
    const healing = screen.getByRole("button", { name: "Apply healing" });
    if (limits === "bounded") {
      expect(damage).toBeDisabled();
      expect(damage.title).toMatch(/minimum \(0\)/);
      fireEvent.click(damage); expect(onAdjust).not.toHaveBeenCalled();
    } else {
      expect(damage).toBeEnabled();
      fireEvent.click(damage); expect(onAdjust).toHaveBeenCalledWith(["0"], -1);
    }
    expect(healing).toBeEnabled();
  });
  it.each(["bounded", "negative", "unbounded"] as const)("respects %s maximum limits", (limits) => {
    const onAdjust = setup(limits, [20]);
    const healing = screen.getByRole("button", { name: "Apply healing" });
    if (limits !== "unbounded") {
      expect(healing).toBeDisabled(); expect(healing.title).toMatch(/maximum/);
      fireEvent.click(healing); expect(onAdjust).not.toHaveBeenCalled();
    } else {
      expect(healing).toBeEnabled();
      fireEvent.click(healing); expect(onAdjust).toHaveBeenCalledWith(["0"], 1);
    }
    expect(screen.getByRole("button", { name: "Apply damage" })).toBeEnabled();
  });
  it.each([[0, 0, undefined], [20, 20, undefined]])("disables bulk actions only when all configured actors are capped: %j", (...currents) => {
    setup("bounded", currents);
    const atMinimum = currents[0] === 0;
    expect(screen.getByRole("button", { name: atMinimum ? "Apply damage" : "Apply healing" })).toBeDisabled();
    expect(screen.getByRole("button", { name: atMinimum ? "Apply healing" : "Apply damage" })).toBeEnabled();
  });
  it("keeps bulk actions enabled when at least one configured actor can change", () => {
    setup("bounded", [0, 20, undefined]);
    expect(screen.getByRole("button", { name: "Apply damage" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply healing" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply damage" }));
    expect(screen.getByRole("dialog", { name: "Skip actors without hit points?" })).toBeInTheDocument();
  });
  it("disables further capped actions for values already outside the saved limits", () => {
    setup("bounded", [-5]);
    expect(screen.getByRole("button", { name: "Apply damage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply healing" })).toBeEnabled();
  });
});
