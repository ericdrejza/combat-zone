import type { RootState } from "@store/store";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearZoneColorPreview, setZoneColorPreview, type ZoneColorPreview } from "@interaction/interactionState";
import type { CommitZoneProperties } from "./types";

/** Coalesce visual drafts per frame; a completed selection still produces only one history edit. */
export function useZoneColorControl({ zoneId, property, value, disabled, onCommit }: {
  zoneId: string; property: ZoneColorPreview["property"]; value: string; disabled?: boolean; onCommit: CommitZoneProperties;
}) {
  const dispatch = useDispatch();
  const previewActive = useSelector((state: RootState) => state.interaction.zoneColorPreview?.zoneId === zoneId);
  const [draft, setDraft] = useState(value);
  const frame = useRef<number | null>(null);
  const pending = useRef(value);
  const cancelFrame = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  useEffect(() => { if (!previewActive) setDraft(value); }, [value, zoneId, property, disabled, previewActive]);
  useEffect(() => () => {
    cancelFrame();
    dispatch(clearZoneColorPreview({ zoneId }));
  }, [dispatch, zoneId, property, disabled]);
  function preview(color: string | null) {
    if (!color || disabled) return;
    setDraft(color); pending.current = color;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      dispatch(setZoneColorPreview({ zoneId, property, color: pending.current }));
    });
  }
  function commit(color: string | null) {
    if (!color || disabled) return;
    cancelFrame();
    if (color.toLowerCase() === value.toLowerCase()) {
      dispatch(clearZoneColorPreview({ zoneId }));
      return;
    }
    dispatch(setZoneColorPreview({ zoneId, property, color }));
    onCommit({ [property]: color });
  }
  function cancel() {
    cancelFrame(); setDraft(value); pending.current = value;
    dispatch(clearZoneColorPreview({ zoneId }));
  }
  return { draft, preview, commit, cancel };
}
