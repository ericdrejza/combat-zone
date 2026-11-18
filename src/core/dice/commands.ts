/** Shared by command parsing and completion so every supported alias is discoverable. */
export const DICE_COMMANDS = ["r", "roll", "rr"] as const;
export const DICE_COMMAND_PATTERN = new RegExp(`^/(${DICE_COMMANDS.join("|")})(?:\\s+|$)([\\s\\S]*)$`, "i");
