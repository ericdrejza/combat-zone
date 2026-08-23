export type InitiativeParticipantGesture = "singleClick" | "doubleClick";
export type InitiativeParticipantIntent = "selectActor" | "makeCurrent" | "none";

export type InitiativeParticipantInteractionContext = {
  combatStarted: boolean;
  modifiers: InitiativeParticipantSelectionModifiers;
};

export type InitiativeParticipantSelectionModifiers = {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/** Resolves panel gestures independently from their Redux/UI side effects. */
export type InitiativeParticipantInteractionStrategy = {
  resolveIntent(
    gesture: InitiativeParticipantGesture,
    context: InitiativeParticipantInteractionContext
  ): InitiativeParticipantIntent;
};

export const DEFAULT_INITIATIVE_PARTICIPANT_INTERACTION_STRATEGY: InitiativeParticipantInteractionStrategy = {
  resolveIntent(gesture, { combatStarted }) {
    if (gesture === "singleClick") return "selectActor";
    return combatStarted ? "makeCurrent" : "none";
  }
};
