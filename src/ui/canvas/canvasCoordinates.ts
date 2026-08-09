import type { LayoutPoint } from '@core/layout/types';

export type CanvasViewBox = {
  height: number;
  width: number;
  x?: number;
  y?: number;
};

type CanvasViewportBounds = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>;

type ViewBoxTransform = {
  contentLeft: number;
  contentTop: number;
  scale: number;
};

/**
 * Mirrors the root SVG's default `xMidYMid meet` transform. Keeping this
 * calculation shared prevents Motion drags and native pointer handlers from
 * interpreting letterboxed workspace coordinates differently.
 */
export function getViewBoxTransform(
  bounds: CanvasViewportBounds,
  viewBox: CanvasViewBox
): ViewBoxTransform | null {
  if (
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    return null;
  }

  const scale = Math.min(
    bounds.width / viewBox.width,
    bounds.height / viewBox.height
  );
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;

  return {
    contentLeft: bounds.left + (bounds.width - renderedWidth) / 2,
    contentTop: bounds.top + (bounds.height - renderedHeight) / 2,
    scale
  };
}

/** Converts a viewport-relative client point into root SVG coordinates. */
export function clientPointToViewBoxPoint(
  point: LayoutPoint,
  bounds: CanvasViewportBounds,
  viewBox: CanvasViewBox
): LayoutPoint {
  const transform = getViewBoxTransform(bounds, viewBox);

  if (!transform) {
    return point;
  }

  return {
    x:
      (point.x - transform.contentLeft) / transform.scale +
      (viewBox.x ?? 0),
    y:
      (point.y - transform.contentTop) / transform.scale +
      (viewBox.y ?? 0)
  };
}

/**
 * Creates Motion's page-point transform using the same uniform SVG scale as
 * native canvas events. Motion keeps page-space origins but needs SVG-scaled
 * deltas, so the fitted content origin is added back after scaling.
 */
export function createCanvasMotionPointTransform(
  svgRef: { current: SVGSVGElement | null }
): (point: LayoutPoint) => LayoutPoint {
  return (point) => {
    const svg = svgRef.current;
    const viewBox = svg?.viewBox?.baseVal;

    if (!svg || !viewBox) {
      return point;
    }

    const bounds = svg.getBoundingClientRect();
    const transform = getViewBoxTransform(bounds, viewBox);

    if (!transform) {
      return point;
    }

    const pageContentLeft = transform.contentLeft + window.scrollX;
    const pageContentTop = transform.contentTop + window.scrollY;

    return {
      x:
        (point.x - pageContentLeft) / transform.scale +
        pageContentLeft,
      y:
        (point.y - pageContentTop) / transform.scale +
        pageContentTop
    };
  };
}
