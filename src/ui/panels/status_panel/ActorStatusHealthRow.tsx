import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useResolvedImageSource } from '@core/assets/ImageAssetResolver';
import type { Actor } from '@entities/actor/types';
import { ActorStatusImage } from './ActorStatusImage';
import { useStatusDashboard } from './StatusDashboardContext';
import { healthRowImageSize } from './healthRowImageSize';

type ImagePlacement = { size: number; wrapped: boolean; left: number; height: number };

/** Measure existing controls independently so an image never changes their wrapping. */
export function ActorStatusHealthRow({ actor, displayName, names, children }: { actor?: Actor; displayName?: string; names: ReactNode; children: ReactNode }) {
  const dashboard = useStatusDashboard();
  const imageUrl = useResolvedImageSource(dashboard ? actor?.image : undefined);
  const row = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLDivElement>(null);
  const healthRow = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<ImagePlacement | null>(null);
  const hasImage = Boolean(imageUrl);
  useLayoutEffect(() => {
    const element = row.current;
    const group = content.current;
    if (!element || !group || !dashboard || !hasImage) { setPlacement(null); return; }
    const ownerWindow = element.ownerDocument.defaultView;
    const controls = Array.from(healthRow.current?.children ?? []);
    let canceled = false;
    const measure = () => {
      if (canceled) return;
      const bounds = group.getBoundingClientRect();
      const gap = Number.parseFloat(ownerWindow?.getComputedStyle(element).columnGap ?? '') || 24;
      const health = controls[0]?.getBoundingClientRect();
      const hitPoints = controls[1]?.getBoundingClientRect();
      const wrapped = Boolean(health && hitPoints && hitPoints.top > health.top + 1);
      const nameBounds = name.current?.getBoundingClientRect();
      const width = wrapped && health && nameBounds ? Math.max(health.right, nameBounds.right) - bounds.left : bounds.width;
      const height = wrapped && health && nameBounds ? Math.max(health.bottom, nameBounds.bottom) - bounds.top : bounds.height;
      const size = healthRowImageSize(element.clientWidth, width, height, gap);
      const next = size > 0 ? { size, wrapped, left: width + gap, height } : null;
      setPlacement((previous) => previous?.size === next?.size && previous?.wrapped === next?.wrapped && previous?.left === next?.left && previous?.height === next?.height ? previous : next);
    };
    measure();
    const Observer = ownerWindow?.ResizeObserver ?? globalThis.ResizeObserver;
    const observer = Observer ? new Observer(measure) : null;
    [element, group, name.current, ...controls].forEach((node) => { if (node) observer?.observe(node); });
    ownerWindow?.addEventListener('resize', measure);
    void element.ownerDocument.fonts?.ready.then(measure);
    return () => { canceled = true; observer?.disconnect(); ownerWindow?.removeEventListener('resize', measure); };
  }, [dashboard, hasImage, actor?.id, displayName]);
  return <div ref={row} className={dashboard ? 'relative flex items-center gap-6' : undefined}>
    <div ref={content} className={`space-y-4 ${dashboard ? 'w-fit min-w-0 max-w-full shrink-0' : ''}`}>
      <div ref={name} className={dashboard ? 'w-fit max-w-full' : undefined}>{names}</div>
      <div ref={healthRow} className={dashboard ? 'flex flex-wrap items-start gap-x-6 gap-y-4' : 'space-y-4'}>{children}</div>
    </div>
    {dashboard && actor && imageUrl && placement ? <div
      className={placement.wrapped ? 'absolute right-0 top-0 flex items-center justify-center' : 'flex min-w-0 flex-1 self-stretch items-center justify-center'}
      style={placement.wrapped ? { left: placement.left, height: placement.height } : undefined}>
      <ActorStatusImage actor={actor} displayName={displayName} src={imageUrl} size={placement.size} className="shrink-0" />
    </div> : null}
  </div>;
}
