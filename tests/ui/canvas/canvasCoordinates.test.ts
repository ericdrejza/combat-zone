import {
  clientPointToViewBoxPoint,
  createCanvasMotionPointTransform,
  getViewBoxTransform
} from '@ui/canvas/canvasCoordinates';

const VIEW_BOX = { height: 640, width: 960 };

describe('canvas coordinate transforms', () => {
  it('accounts for horizontal letterboxing with one uniform scale', () => {
    const bounds = { height: 640, left: 100, top: 20, width: 1200 };

    expect(getViewBoxTransform(bounds, VIEW_BOX)).toEqual({
      contentLeft: 220,
      contentTop: 20,
      scale: 1
    });
    expect(
      clientPointToViewBoxPoint({ x: 260, y: 70 }, bounds, VIEW_BOX)
    ).toEqual({ x: 40, y: 50 });
  });

  it('accounts for vertical letterboxing with one uniform scale', () => {
    const bounds = { height: 800, left: 30, top: 50, width: 960 };

    expect(getViewBoxTransform(bounds, VIEW_BOX)).toEqual({
      contentLeft: 30,
      contentTop: 130,
      scale: 1
    });
    expect(
      clientPointToViewBoxPoint({ x: 70, y: 180 }, bounds, VIEW_BOX)
    ).toEqual({ x: 40, y: 50 });
  });

  it('scales both axes equally in a proportionally smaller viewport', () => {
    const bounds = { height: 320, left: 10, top: 20, width: 480 };

    expect(
      clientPointToViewBoxPoint({ x: 50, y: 45 }, bounds, VIEW_BOX)
    ).toEqual({ x: 80, y: 50 });
  });

  it('gives Motion uniform deltas regardless of letterbox margins', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { height: 640, width: 960, x: 0, y: 0 } }
    });
    svg.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 1200,
      toJSON() {},
      top: 0,
      width: 1200,
      x: 0,
      y: 0
    });
    const transform = createCanvasMotionPointTransform({ current: svg });
    const start = transform({ x: 200, y: 100 });
    const end = transform({ x: 240, y: 125 });

    expect({ x: end.x - start.x, y: end.y - start.y }).toEqual({
      x: 40,
      y: 25
    });
  });
});
