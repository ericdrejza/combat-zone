import type { LibrarySectionId } from "@library/types";
import type { ToolId } from "@interaction/tools/toolRegistry";

/** The panel only exposes assets that the active tool can use. */
export function getLibraryPanelSectionId(tool: ToolId): LibrarySectionId | null {
  if (tool === "actor") return "tokens";
  if (tool === "background") return "backgrounds";
  if (tool === "audio") return "audio";
  return null;
}
