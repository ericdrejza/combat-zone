import { useEffect, useRef } from 'react';
import { ZoomIn } from 'lucide-react';
import { useCanvasViewport } from '../CanvasViewportContext';
import { alignmentButton } from './AlignmentPanel';

/** Keep the first zoom snapshot until closing, unless another zoom command takes over. */
export function TemporaryAlignmentZoom({ hidden }: { hidden: boolean }) {
  const { beginTemporaryMaxZoom } = useCanvasViewport();
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);
  return <button hidden={hidden} type="button" aria-label="Temporary maximum zoom" title="Zoom to 400%; closing restores your previous zoom unless you change zoom again"
    className={`${alignmentButton} shrink-0 px-2`} onClick={() => {
      release.current?.();
      release.current = beginTemporaryMaxZoom();
    }}><ZoomIn size={16} aria-hidden="true" /></button>;
}
