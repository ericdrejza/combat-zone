import { useEffect, useRef, useState } from "react";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "@store/store";
import { matchesKeybind, useKeybinds } from "@ui/keybinds";
import { ignoreShortcut } from "@ui/keybinds/keyboardGuards";
import { HealDamageDialog } from "./HealDamageDialog";

export function ActorHealthKeyboard() {
  const store = useStore<RootState>();
  const { bindings } = useKeybinds();
  const encounter = useSelector((s: RootState) => s.encounter.present);
  const selection = useSelector((s: RootState) => s.interaction.selection);
  const tool = useSelector((s: RootState) => s.interaction.activeToolId);
  const key = `${encounter.id}:${tool}:${selection.selectedEntityType}:${selection.selectedIds.join("|")}`;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey === key;
  const openRef = useRef(open); openRef.current = open;
  const actors = selection.selectedEntityType === "actor" ? selection.selectedIds.map((id) => encounter.actors.byId[id]).filter(Boolean) : [];
  useEffect(() => { setOpenKey(null); }, [key]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!matchesKeybind(event, bindings["actor.healDamage"]) || event.defaultPrevented) return;
      if (!openRef.current && (ignoreShortcut(event) || !actors.length || (tool !== "actor" && tool !== "select"))) return;
      event.preventDefault(); event.stopPropagation();
      if (event.repeat) return;
      setOpenKey(openRef.current ? null : key);
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [actors.length, bindings, key, tool]);
  return open && actors.length ? <HealDamageDialog actors={actors} isCurrent={() => {
    const state = store.getState();
    return `${state.encounter.present.id}:${state.interaction.activeToolId}:${state.interaction.selection.selectedEntityType}:${state.interaction.selection.selectedIds.join("|")}` === key;
  }} onClose={() => setOpenKey(null)} /> : null;
}
