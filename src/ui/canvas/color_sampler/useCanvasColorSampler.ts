import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import type { EncounterState } from '@core/encounter/types';
import { toSvgPoint } from '@ui/canvas/zones/zoneGeometry';
import { useColorSampler } from './ColorSamplerProvider';
import { sampleBackgroundPixel } from './sampleBackgroundPixel';
import './colorSampler.css';

/** Capture sampling before drawing/selection; preserve right-drag navigation. */
export function useCanvasColorSampler(encounter: EncounterState) {
  const sampler = useColorSampler();
  const right = useRef<{ x: number; y: number; moved: boolean }>();
  const suppressContextMenu = useRef(false);
  useEffect(() => {
    if (!sampler.session) return;
    const move = (event: globalThis.MouseEvent) => { if (right.current && Math.hypot(event.clientX - right.current.x, event.clientY - right.current.y) >= 2) right.current.moved = true; };
    const up = (event: globalThis.MouseEvent) => { if (event.button !== 2 || !right.current) return; const cancel = !right.current.moved; right.current = undefined; if (cancel) sampler.cancel(); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { right.current = undefined; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [sampler.session, sampler.cancel]);
  const captureDown = (event: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>) => {
    if (!sampler.session) { suppressContextMenu.current = false; return; }
    if (event.button === 2) { suppressContextMenu.current = true; right.current = { x: event.clientX, y: event.clientY, moved: false }; return; }
    event.preventDefault(); event.stopPropagation();
  };
  return { active: !!sampler.session, kind: sampler.session?.kind, captureDown,
    captureContextMenu: (event: MouseEvent<SVGSVGElement>) => {
      if (!sampler.session && !suppressContextMenu.current) return false;
      suppressContextMenu.current = !!sampler.session; event.preventDefault(); event.stopPropagation(); return true;
    },
    captureClick: (event: MouseEvent<SVGSVGElement>) => {
      const session = sampler.session;
      if (!session) return;
      event.preventDefault(); event.stopPropagation();
      if (event.button !== 0) return;
      if (session.kind === 'zone') {
        const entity = (event.target as Element).closest('[data-entity-type="zone"]');
        const id = entity?.getAttribute('data-entity-id');
        if (id) sampler.choose(session, id);
      } else {
        const svg = event.currentTarget, point = toSvgPoint(event, svg);
        void sampleBackgroundPixel(svg, encounter, point).then(color => sampler.choose(session, color), () => sampler.fail(session));
      }
    }
  };
}
