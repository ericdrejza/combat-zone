import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";

type ZoneOpacityControlOptions = {
  onCancelPreview: () => void;
  onCommit: (opacity: number) => void;
  onPreview: (opacity: number) => void;
  opacity: number;
  zoneId: string;
};

/** Keeps range input tracking local while coalescing canvas previews per frame. */
export function useZoneOpacityControl({
  onCancelPreview,
  onCommit,
  onPreview,
  opacity,
  zoneId
}: ZoneOpacityControlOptions) {
  const [draftOpacity, setDraftOpacity] = useState(opacity);
  const draggingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingOpacityRef = useRef(opacity);
  const lastCommittedRef = useRef(opacity);

  useEffect(() => {
    if (!draggingRef.current) {
      setDraftOpacity(opacity);
      pendingOpacityRef.current = opacity;
      lastCommittedRef.current = opacity;
    }
  }, [opacity, zoneId]);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
  }, []);

  function schedulePreview(nextOpacity: number) {
    pendingOpacityRef.current = nextOpacity;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      onPreview(pendingOpacityRef.current);
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextOpacity = Number(event.currentTarget.value);
    setDraftOpacity(nextOpacity);
    pendingOpacityRef.current = nextOpacity;
    if (draggingRef.current) {
      schedulePreview(nextOpacity);
      return;
    }
    lastCommittedRef.current = nextOpacity;
    onCommit(nextOpacity);
  }

  function handlePointerDown(event: PointerEvent<HTMLInputElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<HTMLInputElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const nextOpacity = Number(event.currentTarget.value);
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    onPreview(nextOpacity);
    lastCommittedRef.current = nextOpacity;
    onCommit(nextOpacity);
  }

  function handlePointerCancel() {
    draggingRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setDraftOpacity(opacity);
    pendingOpacityRef.current = opacity;
    onCancelPreview();
  }

  function handleBlur() {
    if (draggingRef.current || draftOpacity === lastCommittedRef.current) return;
    lastCommittedRef.current = draftOpacity;
    onCommit(draftOpacity);
  }

  return {
    draftOpacity,
    handleBlur,
    handleChange,
    handlePointerCancel,
    handlePointerDown,
    handlePointerUp
  };
}
