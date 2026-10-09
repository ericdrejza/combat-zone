import { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { useCanvasViewport } from "@ui/canvas/CanvasViewportContext";
import { useAudioPlayback } from "@ui/audio/AudioPlaybackProvider";
import { useKeybinds } from "./KeybindProvider";
import { matchesKeybind, type KeybindActionId } from "./keybindDefinitions";
import { ignoreShortcut } from "./keyboardGuards";

/** Uses the same transport and viewport operations as visible application controls. */
export function WorkspaceKeyboardShortcuts({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { bindings } = useKeybinds();
  const viewport = useCanvasViewport();
  const audio = useAudioPlayback();
  const tool = useSelector((s: RootState) => s.interaction.activeToolId);
  const selection = useSelector((s: RootState) => s.interaction.selection);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll('[aria-modal="true"]')];
      // Grid editing needs viewport zoom to inspect its live preview, including from focused fields.
      const gridSettingsOpen = dialogs.length === 1 && dialogs[0].hasAttribute('data-grid-settings-dialog');
      const zoomIds: KeybindActionId[] = ['viewport.zoomOut', 'viewport.zoomIn', 'viewport.fitWidth', 'viewport.fitHeight', 'viewport.fit', 'viewport.reset'];
      const gridZoom = gridSettingsOpen && zoomIds.some(id => matchesKeybind(event, bindings[id]));
      if (event.defaultPrevented || (!gridZoom && ignoreShortcut(event))) return;
      // Physical Shift+Plus is also ordinary Plus on many layouts; actor sizing wins.
      if (!gridSettingsOpen && (tool === "actor" || tool === "select") && selection.selectedEntityType === "actor" && selection.selectedIds.length && matchesKeybind(event, bindings["actor.sizeIncrease"])) return;
      const commands: Partial<Record<KeybindActionId, () => void>> = {
        "viewport.zoomOut": viewport.zoomOut, "viewport.zoomIn": viewport.zoomIn,
        "viewport.fitWidth": viewport.zoomToFitWidth, "viewport.fitHeight": viewport.zoomToFitHeight,
        "viewport.fit": viewport.zoomToFit, "viewport.reset": viewport.resetZoom,
        "viewport.panUp": () => viewport.pan("up"), "viewport.panDown": () => viewport.pan("down"),
        "viewport.panLeft": () => viewport.pan("left"), "viewport.panRight": () => viewport.pan("right"),
        "library.open": onOpenLibrary,
        "audio.toggle": () => { if (audio.hasRunningPlayback) audio.pauseAll(); else if (audio.hasPausedPlayback) audio.resumeAll(); }
      };
      const id = (Object.keys(commands) as KeybindActionId[]).find((id) => matchesKeybind(event, bindings[id]));
      if (!id) {
        // A focused scroll container otherwise implements browser-native arrow panning.
        if (event.key.startsWith("Arrow") && event.target instanceof HTMLElement && event.target.closest("[data-canvas-zoom]")) event.preventDefault();
        return;
      }
      event.preventDefault();
      if (event.repeat && (id === "audio.toggle" || id === "library.open")) return;
      commands[id]?.();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [audio, bindings, onOpenLibrary, selection, tool, viewport]);
  return null;
}
