import { render, screen } from '@testing-library/react';
import { ActorVisual } from '@ui/canvas/actors/ActorVisual';
import { actorLabelOffset } from '@ui/canvas/actors/actorLabelGeometry';
import { createActor } from './actorLayerTestFixtures';
import type { ActorShape } from '@entities/actor/types';

const actor = { ...createActor('zoneless'), shape: 'transparent' as const };
const props = { actor, clipId: 'image-clip', fillColor: '#ff0000', outlineColor: '#00ff00', radius: 60,
  selected: false, selectedTextColor: '#000000', showFactionOutline: true, transition: { duration: 0 } };

it('shows unmasked, aspect-preserving artwork with a square hit box and no permanent frame', () => {
  const { container, rerender } = render(<svg><ActorVisual {...props} /></svg>);
  const image = container.querySelector('image')!;
  expect(image.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  expect(image.hasAttribute('clip-path')).toBe(false);
  expect(image.getAttribute('width')).toBe('120');
  const hit = container.querySelector('[data-actor-logical-hit-area]')!;
  expect(hit.tagName).toBe('rect'); expect(hit.getAttribute('width')).toBe('120');
  expect(container.querySelectorAll('rect[stroke], circle[stroke]')).toHaveLength(0);
  expect(container.querySelector('circle')).toBeNull();
  rerender(<svg><ActorVisual {...props} selected /></svg>);
  expect(container.querySelectorAll('rect[stroke], circle[stroke]')).toHaveLength(1);
  expect(container.querySelector('rect[stroke]')!.getAttribute('stroke-dasharray')).toBe('5 5');
});

it('retains the upright name fallback without an image or colored background', () => {
  const { container } = render(<svg><ActorVisual {...props} actor={{ ...actor, image: undefined }} /></svg>);
  expect(screen.getByText('AEGIS')).toBeInTheDocument();
  expect(container.querySelector('image')).toBeNull();
  expect(container.querySelector('rect')!.getAttribute('fill')).toBe('transparent');
});

it.each(['circle', 'rectangle', 'transparent'] as ActorShape[])('keeps projected %s label clearance constant as token size grows', shape => {
  const extent = actorLabelOffset(shape, 30, 0) - 16;
  for (const radius of [22.5, 30, 60, 90]) {
    expect(actorLabelOffset(shape, radius, 0) - extent * radius / 30).toBeCloseTo(16);
    expect(actorLabelOffset(shape, radius)).toBe(radius + 16);
  }
  expect(actorLabelOffset(shape, 90, 0)).toBeLessThan(90 + 16);
});

it('uses the configured angle and rotation when positioning upright projected names', () => {
  expect(actorLabelOffset('rectangle', 60, 0, 30)).toBeCloseTo(60 * Math.tan(Math.PI / 6) + 16);
  expect(actorLabelOffset('circle', 60, 90, 30)).toBeCloseTo(60 * Math.SQRT1_2 + 16);
  const { container } = render(<svg><ActorVisual {...props} projectionRotation={0} projectionAngle={30} /></svg>);
  expect(Number(container.querySelector('text')!.getAttribute('dy'))).toBeCloseTo(actorLabelOffset('transparent', 60, 0, 30) - 5);
});

it('reflects artwork without reflecting its label or faction outlines', () => {
  const { container, rerender } = render(<svg><ActorVisual {...props} actor={{ ...actor, imageFlippedHorizontal: true }} /></svg>);
  const artwork = container.querySelector('[data-actor-image-artwork]')!;
  expect(artwork.getAttribute('scaleX')).toBe('-1');
  expect(artwork.querySelector('image')).not.toBeNull();
  expect(artwork.querySelector('text')).toBeNull();
  rerender(<svg><ActorVisual {...props} /></svg>);
  expect(container.querySelector('[data-actor-image-artwork]')!.getAttribute('scaleX')).toBe('1');
});
