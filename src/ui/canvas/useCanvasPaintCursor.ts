import { useSelector } from "react-redux";

import type { RootState } from "@store/store";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import "./paintCursor.css";

/** Native cursor feedback follows both paint tools without tracking pointer movement. */
export function useCanvasPaintCursor(): string {
  const painting = useSelector((state: RootState) =>
    state.interaction.actorPaintBrush || state.interaction.zonePaintBrush !== null
  );
  const { readOnly } = usePersistence();
  return painting && !readOnly ? " canvas-paint-cursor" : "";
}
