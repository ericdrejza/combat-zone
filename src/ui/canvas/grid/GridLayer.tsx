import { resolveGridGeometry } from '@core/movement/gridScale';
import { CompletedGridClip } from './CompletedGridClip';
import { useId } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import type { EncounterState } from '@core/encounter/types';
import { gridAngle } from '@core/movement/gridGeometry';
import { calibrateGrid } from '@core/movement/gridCalibration';
import { WarpedGridLayer } from './WarpedGridLayer';

/** A repeating SVG pattern avoids creating one DOM element per grid cell. */
export function GridLayer({ encounter }: { encounter: EncounterState }) {
  const id = useId().replace(/:/g, '');
  const { gridPreview, gridCalibrationActive, gridCalibrationPoints, gridCalibrationMode, gridCalibrationType } = useSelector((state: RootState) => state.interaction);
  const draftGrid = gridCalibrationActive ? { ...encounter.grid, type: gridCalibrationType } : encounter.grid;
  const alignmentPreview = gridCalibrationActive ? gridPreview : null;
  const grid = alignmentPreview ?? (gridCalibrationActive && gridCalibrationMode === 'simple' ? calibrateGrid(draftGrid, gridCalibrationPoints) : null) ?? resolveGridGeometry(draftGrid);
  if (!grid.visible && !gridCalibrationActive && !gridPreview) return null;
  const clipId = `${id}-completed`;
  if (grid.warp) return <g clipPath={`url(#${clipId})`}><defs><CompletedGridClip id={clipId} grid={grid} encounter={encounter} /></defs><WarpedGridLayer grid={grid} canvas={encounter.canvasSize} /></g>;
  const cell = grid.cellSize, radius = cell / Math.sqrt(3);
  const width = grid.type === 'square' ? cell : 3 * radius;
  const hexagon = (x: number, y: number) => Array.from({ length: 6 }, (_, k) => `${x + radius * Math.cos(k * Math.PI / 3)},${y + radius * Math.sin(k * Math.PI / 3)}`).join(' ');
  return <g aria-label="Grid overlay" pointerEvents="none" clipPath={`url(#${clipId})`}>
    <defs><CompletedGridClip id={clipId} grid={grid} encounter={encounter} /><pattern id={id} patternUnits="userSpaceOnUse" width={width} height={cell}
      patternTransform={`translate(${grid.origin.x} ${grid.origin.y}) rotate(${gridAngle(grid) * 180 / Math.PI})`}>
      <g fill="none" stroke={grid.color} strokeWidth={1}>
        {grid.type === 'square' ? <path d={`M ${cell} 0 L 0 0 0 ${cell}`} /> : <>
          <polygon points={hexagon(0, 0)} /><polygon points={hexagon(0, cell)} />
          <polygon points={hexagon(1.5 * radius, cell / 2)} />
          <polygon points={hexagon(3 * radius, 0)} /><polygon points={hexagon(3 * radius, cell)} />
        </>}
      </g>
    </pattern></defs>
    <rect width={encounter.canvasSize.width} height={encounter.canvasSize.height} fill={`url(#${id})`} opacity={grid.opacity} />
  </g>;
}
