import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ColorRangeInput } from "./ColorRangeInput";
import { hexToHsv, hsvToHex, type HsvColor } from "./colorSpectrum";

/** A saturation/brightness plane with hue control, independent of canvas zoom and dragging. */
export function ColorSpectrum({ label, value, onChange, onCommit, onCancel }: { onCancel?: () => void; label: string; value: string; onChange: (color: string) => void; onCommit: (color: string) => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const latest = useRef(hsv);
  const emitted = useRef(value);
  const pointer = useRef<number | null>(null);
  useEffect(() => {
    if (value.toLowerCase() === emitted.current.toLowerCase()) return;
    const next = hexToHsv(value, latest.current.h);
    latest.current = next; emitted.current = value; setHsv(next);
  }, [value]);
  function update(patch: Partial<HsvColor>) {
    const next = { ...latest.current, ...patch };
    latest.current = next; setHsv(next);
    const color = hsvToHex(next);
    emitted.current = color; onChange(color);
  }
  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    update({ s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      v: Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)) });
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div className="space-y-3">
    <div role="slider" tabIndex={0} aria-label={`${label} saturation and brightness`} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s * 100)} aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness. Left/right adjust saturation; up/down adjust brightness.`}
      className="relative h-36 w-full cursor-crosshair rounded-lg border border-canvas-line hover:ring-2 hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
      style={{ touchAction: "none", background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
        pointer.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); point(event);
      }}
      onPointerMove={event => { if (pointer.current === event.pointerId) { event.preventDefault(); event.stopPropagation(); point(event); } }}
      onPointerUp={event => { if (pointer.current === event.pointerId) { event.preventDefault(); event.stopPropagation(); point(event); finish(event); onCommit(hsvToHex(latest.current)); } }}
      onPointerCancel={event => { if (pointer.current !== null) { finish(event); onCancel?.(); } }}
      onLostPointerCapture={() => { if (pointer.current !== null) { pointer.current = null; onCancel?.(); } }}
      onKeyUp={event => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) onCommit(hsvToHex(latest.current));
      }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const step = event.shiftKey ? 0.1 : 0.01;
        update(event.key === "ArrowLeft" || event.key === "ArrowRight"
          ? { s: Math.max(0, Math.min(1, latest.current.s + (event.key === "ArrowRight" ? step : -step))) }
          : { v: Math.max(0, Math.min(1, latest.current.v + (event.key === "ArrowUp" ? step : -step))) });
      }}>
      <span aria-hidden="true" className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-1 ring-black/60"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }} />
    </div>
    <div>
      <label className="block min-w-0 space-y-1 text-xs"><span>Hue</span>
        <ColorRangeInput aria-label={`${label} hue`} min={0} max={360} step={1} value={hsv.h} onValueChange={h => update({ h })} onValueCommit={() => onCommit(hsvToHex(latest.current))} onValueCancel={onCancel}
          className="h-4 w-full cursor-grab appearance-none rounded-full border-0 bg-transparent active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/20 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/20 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md hover:[&::-moz-range-thumb]:shadow-lg"
          style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }} />
      </label>
    </div>
  </div>;
}
