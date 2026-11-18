/** Opens notation help without discarding the calling editor's draft. */
export const OPEN_DICE_NOTATION_EVENT = "combat-zone:open-dice-notation";
export function openDiceNotation() {
  window.dispatchEvent(new Event(OPEN_DICE_NOTATION_EVENT));
}
