import { CanvasViewportSnapshotContext, usePublishCanvasViewportSnapshot } from '@ui/canvas/useCanvasViewportSnapshot';
import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { useLayoutEffect, type PropsWithChildren } from 'react';
import { store } from '@store/store';
import { loadEncounterState } from '@store/encounterSlice';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { CanvasViewportContext, CanvasViewportProvider, useCanvasViewport, type CanvasViewportValue } from '@ui/canvas/CanvasViewportContext';
import { usePlayerCamera } from '@ui/player_view/usePlayerCamera';

function setup() {
  store.dispatch(loadEncounterState({ ...createEncounterState({ id: 'camera', name: 'Camera' }), canvasSize: { width: 2000, height: 1200 } }));
  const element = document.createElement('div'); element.scrollLeft = 100; element.scrollTop = 100;
  const gm: CanvasViewportValue = {
    element, zoom: 1, viewportSize: { width: 800, height: 600 }, getViewportSize: () => ({ width: 800, height: 600 }),
    panEnabled: true, stopPanAnimation: vi.fn(), pan: vi.fn(), panToPoint: vi.fn(), registerViewport: vi.fn(),
    zoomIn: vi.fn(), zoomOut: vi.fn(), resetZoom: vi.fn(), beginTemporaryMaxZoom: () => () => {},
    setZoomAtPoint: vi.fn(), zoomByWheelAtPoint: vi.fn(), zoomToFit: vi.fn(), zoomToFitHeight: vi.fn(), zoomToFitWidth: vi.fn()
  };
  const wrapper = ({ children }: PropsWithChildren) => {
    const snapshot = usePublishCanvasViewportSnapshot({ element, zoom: gm.zoom, getViewportSize: gm.getViewportSize });
    return <Provider store={store}><CanvasViewportSnapshotContext.Provider value={snapshot}><CanvasViewportContext.Provider value={gm}>{children}</CanvasViewportContext.Provider></CanvasViewportSnapshotContext.Provider></Provider>;
  };
  const view = renderHook(({ width, height }) => usePlayerCamera({ width, height }), { initialProps: { width: 1920, height: 1080 }, wrapper });
  return { ...view, gm, element };
}

it('starts with the exact GM region and zoom, and follows scroll without history', async () => {
  const { result, element, gm } = setup();
  const before = store.getState().encounter;
  expect(result.current.region).toEqual({ x: 100, y: 100, width: 800, height: 600 });
  act(() => result.current.viewport.zoomIn());
  expect(gm.zoomIn).toHaveBeenCalledOnce();
  act(() => result.current.zoomAt(1.1));
  expect(gm.setZoomAtPoint).toHaveBeenCalledWith(1.1, { x: 400, y: 300 }, { x: 500, y: 400 });
  act(() => { element.scrollLeft = 250; fireEvent.scroll(element); });
  await waitFor(() => expect(result.current.region.x).toBe(250));
  expect(store.getState().encounter).toBe(before);
});

it('preserves framing and zoom on unfollow, navigates independently, and resumes GM framing', () => {
  const { result, element, rerender } = setup();
  const initial = result.current.region;
  act(() => result.current.toggleFollow());
  expect(result.current.region).toEqual(initial);
  expect(result.current.viewport.zoom).toBe(1);
  act(() => result.current.panBy(200, 100));
  expect(result.current.region).toEqual({ ...initial, x: 300, y: 200 });
  expect(element.scrollLeft).toBe(100);
  act(() => result.current.zoomAt(2));
  expect(result.current.region).toEqual({ x: 500, y: 350, width: 400, height: 300 });
  rerender({ width: 1080, height: 1920 });
  expect(result.current.region).toEqual({ x: 500, y: 350, width: 400, height: 300 });
  expect(result.current.viewport.zoom).toBe(2);
  act(() => result.current.toggleFollow());
  expect(result.current.region).toEqual(initial);
  act(() => result.current.panBy(50, 25));
  expect(element.scrollLeft).toBe(150); expect(element.scrollTop).toBe(125);
});

it('clamps independent zoom and resets follow when loading another encounter', () => {
  const { result } = setup();
  act(() => result.current.toggleFollow());
  act(() => result.current.zoomAt(10));
  expect(result.current.viewport.zoom).toBe(4);
  act(() => result.current.zoomAt(0));
  expect(result.current.viewport.zoom).toBe(0.2);
  act(() => store.dispatch(loadEncounterState({ ...store.getState().encounter.present, id: 'other' })));
  expect(result.current.following).toBe(true);
});

function realCamera() {
  store.dispatch(loadEncounterState({ ...createEncounterState({ id: 'committed-camera', name: 'Camera' }), canvasSize: { width: 2000, height: 2000 } }));
  const element = document.createElement('div');
  Object.defineProperties(element, { clientWidth: { value: 500 }, clientHeight: { value: 500 } });
  const painted: { x: number; y: number; width: number; height: number }[] = [];
  const wrapper = ({ children }: PropsWithChildren) => <Provider store={store}><CanvasViewportProvider>{children}</CanvasViewportProvider></Provider>;
  const hook = renderHook(() => {
    const gm = useCanvasViewport();
    const camera = usePlayerCamera({ width: 1920, height: 1080 });
    useLayoutEffect(() => { painted.push(camera.region); });
    return { gm, camera };
  }, { wrapper });
  act(() => hook.result.current.gm.registerViewport(element));
  act(() => hook.result.current.gm.resetZoom());
  act(() => { element.scrollLeft = 200; element.scrollTop = 100; fireEvent.scroll(element); });
  painted.length = 0;
  return { ...hook, painted, element };
}

it('publishes compensated GM zoom and scroll before painting any player-camera update', () => {
  const { result, painted, element } = realCamera();
  const before = store.getState().encounter;
  act(() => {
    for (let i = 0; i < 3; i++) result.current.camera.viewport.zoomIn();
  });
  expect(result.current.camera.viewport.zoom).toBe(1.3);
  expect(element.scrollLeft).toBeCloseTo(335);
  expect(element.scrollTop).toBeCloseTo(205);
  expect(painted.length).toBeGreaterThan(0);
  for (const region of painted) {
    expect(region.x + region.width / 2).toBeCloseTo(450);
    expect(region.y + region.height / 2).toBeCloseTo(350);
  }
  expect(store.getState().encounter).toBe(before);
});

it('accumulates following wheel input before render while preserving the pointer anchor', () => {
  const { result, element } = realCamera();
  act(() => {
    for (let i = 0; i < 3; i++) result.current.camera.zoomBy(0.1, { x: 300, y: 200 });
  });
  expect(result.current.camera.viewport.zoom).toBe(1.3);
  expect(element.scrollLeft).toBeCloseTo(290);
  expect(element.scrollTop).toBeCloseTo(160);
  const { region } = result.current.camera;
  expect(region.x + region.width * 0.2).toBeCloseTo(300);
  expect(region.y + region.height * 0.2).toBeCloseTo(200);
});

it('accumulates independent button/wheel input without moving the GM camera', () => {
  const { result, element } = setup();
  act(() => result.current.toggleFollow());
  act(() => {
    for (let i = 0; i < 3; i++) result.current.viewport.zoomIn();
  });
  expect(result.current.viewport.zoom).toBe(1.3);
  expect(result.current.region.x + result.current.region.width / 2).toBeCloseTo(500);
  act(() => result.current.viewport.resetZoom());
  act(() => {
    for (let i = 0; i < 3; i++) result.current.zoomBy(0.1, { x: 300, y: 200 });
  });
  const { region } = result.current;
  expect(result.current.viewport.zoom).toBe(1.3);
  expect(region.x + region.width / 4).toBeCloseTo(300);
  expect(region.y + region.height / 6).toBeCloseTo(200);
  expect(element.scrollLeft).toBe(100);
  expect(element.scrollTop).toBe(100);
});
