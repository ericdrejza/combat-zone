import { useGrabbingCursor } from "@hooks/useGrabbingCursor";
import { ScanSquare, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { focusAtZoom, focusImageStyle, moveFocus, type ImageDimensions, type ImageFocus } from "@core/assets/imageFocus";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import { useImageSourceLease } from "@core/assets/ImageAssetResolver";
import { useStillImageSource } from "@core/assets/useStillImageSource";
import { ControlledVideo } from "@core/rendering/ControlledVideo";
import { isVideoMediaType } from "@library/mediaAsset";
import { useEncounterOperation } from "@ui/history/useEncounterOperation";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ToolbarOptionButton } from "@ui/toolbar/ToolbarOption";

type Props = {
  source: ImageAssetSource;
  mediaType?: string;
  initialFocus?: ImageFocus;
  /** Undefined hides token match; null represents an available, uncropped token. */
  tokenFocus?: ImageFocus | null;
  title: string;
  readOnly: boolean;
  onClose: () => void;
  onSave: (focus?: ImageFocus) => void;
};

const buttonClass = "rounded-xl border border-canvas-line px-3 py-2 text-sm enabled:hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40";

/** Draft-only editor: both guides stay fixed while the original media moves beneath them. */
export function ImageFocusDialog({ source, mediaType, initialFocus, tokenFocus, title, readOnly, onClose, onSave }: Props) {
  useEncounterOperation(true);
  const leaseSource = useImageSourceLease();
  const [src, setSrc] = useState<string | null>(null);
  const { enableAssetAnimation } = useInterfacePreferences();
  const video = isVideoMediaType(mediaType);
  const freeze = !enableAssetAnimation && !video && mediaType === "image/webp";
  const displaySrc = useStillImageSource(src, freeze, "image");
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [focus, setFocus] = useState(initialFocus);
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);
  useGrabbingCursor(dragging);
  const dialog = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; focus: ImageFocus } | null>(null);
  const current = focus ?? (dimensions ? focusAtZoom(dimensions, 1) : undefined);
  const zoom = dimensions && current ? Math.min(dimensions.width, dimensions.height) / (current.width * dimensions.width) : 1;
  const enabled = Boolean(dimensions && current && !error && !readOnly);

  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    void leaseSource(source).then(lease => {
      if (!active) { lease?.release(); return; }
      if (!lease) { setError(true); return; }
      release = lease.release;
      setSrc(lease.url);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; release?.(); };
  }, [source, leaseSource]);

  // Captured stills are downsampled; crop coordinates must use original dimensions.
  useEffect(() => {
    if (!src || video) return;
    const probe = new Image();
    probe.onload = () => loaded(probe.naturalWidth, probe.naturalHeight);
    probe.onerror = () => setError(true);
    probe.src = src;
    return () => { probe.onload = null; probe.onerror = null; };
  }, [src, video]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    frame.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  function loaded(width: number, height: number) {
    if (width > 0 && height > 0) { setDimensions({ width, height }); setError(false); }
    else setError(true);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!enabled || !start || event.pointerId !== start.pointerId) return;
    const size = event.currentTarget.getBoundingClientRect().width;
    if (size > 0) setFocus(moveFocus(start.focus, (event.clientX - start.x) / size, (event.clientY - start.y) / size));
  }

  return createPortal(
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={title}
      className="viewport-overlay z-[120] flex items-center justify-center overflow-y-auto bg-black/40 p-3"
      onPointerDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "Tab") {
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="my-auto w-full max-w-md space-y-4 rounded-2xl border border-canvas-line bg-canvas-surface p-4 text-canvas-ink shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ScanSquare aria-hidden="true" className="h-5 w-5" />{title}</h2>
          <ToolbarOptionButton aria-label="Close image focus" title="Close image focus" onClick={onClose}><X aria-hidden="true" className="h-4 w-4" /></ToolbarOptionButton>
        </div>
        <p className="text-sm text-canvas-muted">Drag the image or use arrow keys to position it. The square and circle show the artwork each token shape captures.</p>
        <div ref={frame} role="group" aria-label="Image focus area" aria-disabled={!enabled} tabIndex={0}
          className={`relative mx-auto aspect-square w-full max-w-80 touch-none overflow-hidden rounded-lg bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${enabled ? "cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-canvas-ink/40" : ""}`}
          onPointerDown={event => {
            if (!enabled || !current || event.button !== 0 || drag.current) return;
            event.preventDefault(); event.currentTarget.focus();
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, focus: current };
          }}
          onPointerMove={move}
          onPointerUp={event => {
            if (event.pointerId !== drag.current?.pointerId) return;
            move(event); drag.current = null; setDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { if (drag.current) setFocus(drag.current.focus); drag.current = null; setDragging(false); }}
          onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
          onKeyDown={event => {
            const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
            if (!offset || !enabled || !current) return;
            event.preventDefault();
            const step = event.shiftKey ? 0.05 : 0.01;
            setFocus(moveFocus(current, offset[0] * step, offset[1] * step));
          }}>
          <motion.div className="pointer-events-none [&>img]:h-full [&>img]:w-full [&>img]:object-fill [&>video]:h-full [&>video]:w-full [&>video]:object-fill"
            style={current ? focusImageStyle(current) : { position: "absolute", inset: 0, opacity: 0 }}>
            {src ? video ? <ControlledVideo ariaLabel="Focus artwork" src={src} play={enableAssetAnimation}
              onLoadedMetadata={event => loaded(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
              onLoadedData={event => loaded(event.currentTarget.videoWidth, event.currentTarget.videoHeight)} onError={() => setError(true)} />
              : displaySrc ? <img alt="Focus artwork" src={displaySrc} draggable={false} onLoad={event => { if (!freeze) loaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight); }} onError={() => setError(true)} /> : null : null}
          </motion.div>
          <div aria-label="Square capture outline" className="pointer-events-none absolute inset-0 border-2 border-canvas-ink ring-1 ring-inset ring-white" />
          <div aria-label="Circle capture outline" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white ring-1 ring-inset ring-black" />
        </div>
        {error ? <p role="alert" className="text-sm text-red-600">The image could not be loaded. Your saved focus has not changed.</p> : !dimensions ? <p role="status" className="text-sm text-canvas-muted">Loading image…</p> : null}
        <label className="block text-sm font-medium">Zoom <output>{Math.round(zoom * 100)}%</output>
          <input aria-label="Image zoom" type="range" min="100" max="400" step="1" value={Math.round(zoom * 100)} disabled={!enabled}
            className="mt-2 w-full accent-canvas-ink enabled:hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink disabled:cursor-not-allowed disabled:opacity-40"
            onChange={event => { if (dimensions) setFocus(focusAtZoom(dimensions, Number(event.target.value) / 100, current)); }} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!enabled} onClick={() => setFocus(undefined)}>Reset</button>
          {tokenFocus !== undefined ? <button type="button" className={buttonClass} disabled={!enabled} onClick={() => setFocus(tokenFocus ?? undefined)}>Reset to token match</button> : null}
          <span className="flex-1" />
          <button type="button" className={buttonClass} onClick={onClose}>Cancel</button>
          <button type="button" className={buttonClass} disabled={!enabled} onClick={() => onSave(focus)}>Save</button>
        </div>
      </div>
    </div>, document.body
  );
}
