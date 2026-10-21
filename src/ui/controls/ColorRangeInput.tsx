import { useRef, type InputHTMLAttributes, type PointerEvent } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'min' | 'max' | 'step' | 'onChange'> & {
  value: number; min: number; max: number; step: number; onValueChange: (value: number) => void; onValueCommit?: (value: number) => void; onValueCancel?: () => void;
};

/** Keep pointer values tied to screen coordinates, independently of modal/canvas drag transforms. */
export function ColorRangeInput({ value, min, max, step, onValueChange, onValueCommit, onValueCancel, disabled, style, ...props }: Props) {
  const pointer = useRef<number | null>(null);
  function update(event: PointerEvent<HTMLInputElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    // Native thumbs are 16px wide; account for their center at either endpoint.
    const track = Math.max(1, bounds.width - 16);
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left - 8) / track));
    const next = min + Math.round(fraction * (max - min) / step) * step;
    const result = Math.max(min, Math.min(max, Number(next.toPrecision(12))));
    onValueChange(result);
    return result;
  }
  function finish(event: PointerEvent<HTMLInputElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <input {...props} type="range" value={value} min={min} max={max} step={step} disabled={disabled}
    style={{ ...style, touchAction: 'none' }}
    onChange={event => onValueChange(Number(event.currentTarget.value))}
    onKeyUp={event => { props.onKeyUp?.(event); if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) onValueCommit?.(Number(event.currentTarget.value)); }}
    onPointerDown={event => {
      if (disabled || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      update(event);
    }}
    onPointerMove={event => {
      if (pointer.current !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation(); update(event);
    }}
    onPointerUp={event => {
      if (pointer.current !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const result = update(event); finish(event);
      if (result !== undefined) onValueCommit?.(result);
    }}
    onPointerCancel={event => { if (pointer.current !== null) { finish(event); onValueCancel?.(); } }}
    onLostPointerCapture={() => { if (pointer.current !== null) { pointer.current = null; onValueCancel?.(); } }} />;
}
