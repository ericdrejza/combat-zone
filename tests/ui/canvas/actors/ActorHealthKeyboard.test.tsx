import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { store } from "@store/store";
import { redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { encounter, setup } from "./actorKeyboardTestSupport";

beforeEach(() => { localStorage.clear(); setPersistenceWritable(true); });
afterEach(() => setPersistenceWritable(true));
const toggle = () => fireEvent.keyDown(window, { key: "h" });

describe("heal/damage keyboard dialog", () => {
  it("retains the amount on Enter, focuses Damage, and preserves normal dialog tab order", async () => {
    const user = userEvent.setup();
    setup(); toggle();
    const amount = screen.getByRole("textbox", { name: "Damage or healing amount" });
    expect(amount).toHaveFocus();
    await user.keyboard("3{Enter}");
    expect(amount).toHaveValue("3");
    expect(screen.getByRole("button", { name: "Apply Damage" })).toHaveFocus();
    expect(store.getState().encounter.past).toHaveLength(0);
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Apply Heal" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Apply Damage" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Decrease damage or healing amount" })).toHaveFocus();
    await user.tab();
    expect(amount).toHaveFocus();
    await user.keyboard("{Enter}{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(store.getState().encounter.present.actors.byId.alpha.hitPoints?.current).toBe(7);
    expect(store.getState().encounter.past).toHaveLength(1);
  });
  it("sorts names, applies a bulk change once, closes, and restores HP through history", async () => {
    setup(encounter(), ["bravo", "alpha"]); toggle();
    const dialog = screen.getByRole("dialog", { name: "Heal/damage actors" });
    expect(within(dialog).getByRole("heading")).toHaveTextContent("AlphaBravo");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Damage or healing amount" }), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply Damage" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(store.getState().encounter.present.actors.byId.alpha.hitPoints?.current).toBe(7);
    expect(store.getState().encounter.present.actors.byId.bravo.hitPoints?.current).toBe(5);
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.actors.byId.alpha.hitPoints?.current).toBe(10);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.actors.byId.bravo.hitPoints?.current).toBe(5);
  });
  it.each(["h", "escape", "backdrop", "close"])("dismisses through %s without applying", (method) => {
    setup(); toggle(); const dialog = screen.getByRole("dialog");
    if (method === "h") fireEvent.keyDown(within(dialog).getByRole("textbox"), { key: "h" });
    if (method === "escape") fireEvent.keyDown(dialog, { key: "Escape" });
    if (method === "backdrop") fireEvent.click(dialog.parentElement!);
    if (method === "close") fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("keeps open when configured and honors partial HP confirmation", async () => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ keepHealDamageDialogOpen: true }));
    const initial = encounter(); delete initial.actors.byId.bravo.hitPoints;
    setup(initial); toggle(); fireEvent.click(screen.getByRole("button", { name: "Apply Heal" }));
    expect(screen.getByRole("dialog", { name: "Skip actors without hit points?" })).toHaveTextContent("Bravo");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Apply Heal" })); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.alpha.hitPoints?.current).toBe(11));
    expect(screen.getByRole("dialog", { name: "Heal/damage actors" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Skip actors without hit points?" })).not.toBeInTheDocument();
  });
  it("requires actor selection and ignores unrelated tools and text inputs", () => {
    setup(); act(() => store.dispatch(setActiveTool("zone"))); toggle(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => { store.dispatch(setActiveTool("select")); store.dispatch(selectEntity({ entityType: "actor", ids: ["alpha"] })); });
    const input = document.createElement("input"); document.body.append(input); fireEvent.keyDown(input, { key: "h" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); input.remove();
    toggle(); expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("disables unconfigured HP and centrally blocks read-only writes", async () => {
    const initial = encounter(); delete initial.actors.byId.alpha.hitPoints; delete initial.actors.byId.bravo.hitPoints;
    const view = setup(initial); toggle();
    expect(screen.getByRole("button", { name: "Apply Heal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply Damage" })).toBeDisabled(); view.unmount();
    setup(); setPersistenceWritable(false); toggle(); fireEvent.click(screen.getByRole("button", { name: "Apply Damage" }));
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(0));
    expect(store.getState().encounter.present.actors.byId.alpha.hitPoints?.current).toBe(10);
  });
});
