import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

import type { AssetLibraryPreviewTarget } from "./assetLibraryView";

const LARGE_HOVER_PREVIEW_QUERY = "(min-width: 1024px) and (hover: hover)";
const PREVIEW_HOLD_DURATION_MS = 500;
const PREVIEW_MOVE_TOLERANCE_PX = 8;

function getLargeHoverPreviewSupport() {
  if (typeof window === "undefined") return false;

  return window.matchMedia
    ? window.matchMedia(LARGE_HOVER_PREVIEW_QUERY).matches
    : window.innerWidth >= 1024;
}

type UseAssetLibraryPreviewOptions = {
  resetKey: string;
};

export function useAssetLibraryPreview({
  resetKey
}: UseAssetLibraryPreviewOptions) {
  const previewClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewHoldStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewHoldTriggeredRef = useRef(false);
  const [previewTarget, setPreviewTarget] =
    useState<AssetLibraryPreviewTarget | null>(null);
  const [largeHoverPreview, setLargeHoverPreview] = useState(
    getLargeHoverPreviewSupport
  );

  useEffect(() => {
    if (!window.matchMedia) {
      const updateFromWidth = () =>
        setLargeHoverPreview(getLargeHoverPreviewSupport());
      window.addEventListener("resize", updateFromWidth);
      return () => window.removeEventListener("resize", updateFromWidth);
    }

    const mediaQuery = window.matchMedia(LARGE_HOVER_PREVIEW_QUERY);
    const updateFromMediaQuery = () => setLargeHoverPreview(mediaQuery.matches);
    updateFromMediaQuery();
    mediaQuery.addEventListener?.("change", updateFromMediaQuery);

    return () => mediaQuery.removeEventListener?.("change", updateFromMediaQuery);
  }, []);

  useEffect(() => {
    setPreviewTarget(null);
    previewHoldTriggeredRef.current = false;
  }, [resetKey]);

  useEffect(
    () => () => {
      if (previewClearTimerRef.current) {
        clearTimeout(previewClearTimerRef.current);
      }
      if (previewHoldTimerRef.current) {
        clearTimeout(previewHoldTimerRef.current);
      }
    },
    []
  );

  function clearPreviewClearTimer() {
    if (previewClearTimerRef.current) {
      clearTimeout(previewClearTimerRef.current);
      previewClearTimerRef.current = null;
    }
  }

  function showPreview(target: AssetLibraryPreviewTarget | null) {
    clearPreviewClearTimer();
    setPreviewTarget(target);
  }

  function schedulePreviewClear() {
    clearPreviewClearTimer();
    previewClearTimerRef.current = setTimeout(() => {
      setPreviewTarget(null);
      previewClearTimerRef.current = null;
    }, 100);
  }

  function beginPreviewInteraction(
    event: PointerEvent<HTMLButtonElement>,
    target: AssetLibraryPreviewTarget | null
  ) {
    if (!target) return;

    if (event.pointerType === "mouse") {
      if (largeHoverPreview) showPreview(target);
      return;
    }

    if (event.pointerType !== "touch" || largeHoverPreview) return;

    if (previewHoldTimerRef.current) clearTimeout(previewHoldTimerRef.current);
    previewHoldStartRef.current = { x: event.clientX, y: event.clientY };
    previewHoldTriggeredRef.current = false;
    previewHoldTimerRef.current = setTimeout(() => {
      showPreview(target);
      previewHoldTriggeredRef.current = true;
      previewHoldTimerRef.current = null;
    }, PREVIEW_HOLD_DURATION_MS);
  }

  function movePreviewInteraction(event: PointerEvent<HTMLButtonElement>) {
    const start = previewHoldStartRef.current;

    if (
      event.pointerType === "touch" &&
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >
        PREVIEW_MOVE_TOLERANCE_PX
    ) {
      endPreviewInteraction(event);
    }
  }

  function endPreviewInteraction(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch") return;

    if (previewHoldTimerRef.current) {
      clearTimeout(previewHoldTimerRef.current);
      previewHoldTimerRef.current = null;
    }
    previewHoldStartRef.current = null;
  }

  function consumePreviewHold() {
    if (!previewHoldTriggeredRef.current) return false;

    previewHoldTriggeredRef.current = false;
    return true;
  }

  return {
    beginPreviewInteraction,
    clearPreviewClearTimer,
    consumePreviewHold,
    endPreviewInteraction,
    largeHoverPreview,
    movePreviewInteraction,
    previewTarget,
    schedulePreviewClear
  };
}
