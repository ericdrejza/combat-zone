import { gridStrokeStyle, regularGridEdgePath } from '@core/measurement/gridLineStyle';
import { isometricSlope, isSquareTopology } from '@core/movement/gridProjection';
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
  const { gridAppearancePreview, gridPreview, gridCalibrationActive, gridCalibrationPoints, gridCalibrationMode, gridCalibrationType } = useSelector((state: RootState) => state.interaction);
  const draftGrid = gridCalibrationActive ? { ...encounter.grid, type: gridCalibrationType } : encounter.grid;
  const alignmentPreview = gridCalibrationActive ? gridPreview : null;
  const geometry = alignmentPreview ?? (gridCalibrationActive && gridCalibrationMode === 'simple' ? calibrateGrid(draftGrid, gridCalibrationPoints) : null) ?? resolveGridGeometry(draftGrid);
  const grid = !gridCalibrationActive && gridAppearancePreview ? { ...geometry, ...gridAppearancePreview } : geometry;
  if (!grid.visible && !gridCalibrationActive && !gridPreview) return null;
  const clipId = `${id}-completed`;
  if (grid.warp) return <g clipPath={`url(#${clipId})`}><defs><CompletedGridClip id={clipId} grid={grid} encounter={encounter} /></defs><WarpedGridLayer grid={grid} canvas={encounter.canvasSize} /></g>;
  const cell = grid.cellSize, radius = cell / Math.sqrt(3);
  const width = isSquareTopology(grid.type) ? cell : 3 * radius;
  const hexagon = (x: number, y: number) => Array.from({ length: 6 }, (_, k) => ({ x: x + radius * Math.cos(k * Math.PI / 3), y: y + radius * Math.sin(k * Math.PI / 3) }));
  return <g aria-label="Grid overlay" pointerEvents="none" clipPath={`url(#${clipId})`}>
    <defs><CompletedGridClip id={clipId} grid={grid} encounter={encounter} /><pattern id={id} patternUnits="userSpaceOnUse" width={width} height={cell}
      patternTransform={`translate(${grid.origin.x} ${grid.origin.y}) rotate(${gridAngle(grid) * 180 / Math.PI})${grid.type === 'isometric' ? ` matrix(0.5 ${isometricSlope(grid) / 2} -0.5 ${isometricSlope(grid) / 2} 0 0)` : ''}`}>
      <g fill="none" stroke={grid.color} strokeWidth={1} {...gridStrokeStyle(grid.lineStyle)}>
        {isSquareTopology(grid.type) ? <path d={regularGridEdgePath([{ x: cell, y: 0 }, { x: 0, y: 0 }, { x: 0, y: cell }], grid.lineStyle, false)} /> : <>
          <path d={regularGridEdgePath(hexagon(0, 0), grid.lineStyle)} /><path d={regularGridEdgePath(hexagon(0, cell), grid.lineStyle)} />
          <path d={regularGridEdgePath(hexagon(1.5 * radius, cell / 2), grid.lineStyle)} />
          <path d={regularGridEdgePath(hexagon(3 * radius, 0), grid.lineStyle)} /><path d={regularGridEdgePath(hexagon(3 * radius, cell), grid.lineStyle)} />
        </>}
      </g>
    </pattern></defs>
    <rect width={encounter.canvasSize.width} height={encounter.canvasSize.height} fill={`url(#${id})`} opacity={grid.opacity} />
  </g>;
}
