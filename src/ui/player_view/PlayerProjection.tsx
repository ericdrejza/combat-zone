import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { PlayerScene } from './PlayerSceneSource';
import { playerFrame } from './playerCamera';
import type { usePlayerCamera } from './usePlayerCamera';
import { useProjectionInput } from './useProjectionInput';
import { FocusLightLayer } from '@ui/canvas/focus/FocusLightLayer';
import { useFocusSurface } from '@ui/canvas/focus/useFocusSurface';
import { projectedFocusPoint } from '@ui/canvas/focus/focusCoordinates';

/** Resolution is a logical frame; preview and browser windows only scale its presentation. */
export function PlayerProjection({ camera, resolution, interactive = false }: {
  camera: ReturnType<typeof usePlayerCamera>; resolution: CanvasSize; interactive?: boolean;
}) {
  const ref = useProjectionInput(camera, resolution, interactive);
  useFocusSurface(ref, (point, element) => projectedFocusPoint(point, element, camera.region, resolution));
  const frame = playerFrame(camera.region, resolution);
  return <div ref={ref} aria-label={interactive ? 'Player preview viewport' : 'Player viewport'}
    data-focus-surface={interactive ? '' : undefined}
    className="min-h-0 flex-1 overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
    style={{ touchAction: 'none' }} tabIndex={interactive ? 0 : undefined}>
    <svg role="img" aria-label="Player encounter view" className="h-full w-full"
      viewBox={`0 0 ${resolution.width} ${resolution.height}`}>
      <svg x={frame.x} y={frame.y} width={camera.region.width * frame.scale} height={camera.region.height * frame.scale}
        viewBox={`${camera.region.x} ${camera.region.y} ${camera.region.width} ${camera.region.height}`} overflow="hidden">
        <PlayerScene />
        <FocusLightLayer />
      </svg>
    </svg>
  </div>;
}
