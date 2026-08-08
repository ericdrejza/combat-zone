import type { LayoutPoint } from "@core/layout/types";
import type { EdgeShape } from "./types";
import { distance } from "./edgeBoundaryGeometry";

function directCurveControl(
  start: LayoutPoint,
  end: LayoutPoint
): LayoutPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = distance(start, end) || 1;
  const direction = dx !== 0 && dy !== 0
    ? Math.sign(dx * dy)
    : dx !== 0
      ? Math.sign(dx)
      : -Math.sign(dy);
  const bend = Math.min(48, length * 0.12);
  const control = {
    x: (start.x + end.x) / 2 - (dy / length) * bend * direction,
    y: (start.y + end.y) / 2 + (dx / length) * bend * direction
  };
  // A diagonal curve must immediately progress in both target directions.
  if (dx !== 0) {
    control.x = Math.max(Math.min(start.x, end.x), Math.min(Math.max(start.x, end.x), control.x));
  }
  if (dy !== 0) {
    control.y = Math.max(Math.min(start.y, end.y), Math.min(Math.max(start.y, end.y), control.y));
  }
  return control;
}

/** Converts routed geometry into the selected visual Edge shape. */
export function routeToSvgPath(path: LayoutPoint[], shape: EdgeShape): string {
  if (path.length === 0) return "";
  if (shape === "straight" || shape === "rightAngled" || path.length < 2) {
    return `M ${path.map((point) => `${point.x} ${point.y}`).join(" L ")}`;
  }
  if (shape === "sigmoid" && path.length === 2) {
    const [start, end] = path;
    const middleX = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} C ${middleX} ${start.y}, ${middleX} ${end.y}, ${end.x} ${end.y}`;
  }
  if (shape === "curved" && path.length === 2) {
    const [start, end] = path;
    const control = directCurveControl(start, end);
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  if (shape === "sigmoid") {
    const commands = [`M ${path[0].x} ${path[0].y}`];
    for (let index = 1; index < path.length; index += 1) {
      const start = path[index - 1];
      const end = path[index];
      const middleX = (start.x + end.x) / 2;
      commands.push(`C ${middleX} ${start.y}, ${middleX} ${end.y}, ${end.x} ${end.y}`);
    }
    return commands.join(" ");
  }
  const commands = [`M ${path[0].x} ${path[0].y}`];
  for (let index = 1; index < path.length - 1; index += 1) {
    const point = path[index];
    const next = path[index + 1];
    commands.push(`Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`);
  }
  const end = path[path.length - 1];
  commands.push(`T ${end.x} ${end.y}`);
  return commands.join(" ");
}
