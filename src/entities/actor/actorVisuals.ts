import type { ActorLayoutGroup, ActorSize } from './types';

export const ACTOR_SIZE_MULTIPLIERS: Record<ActorSize, number> = {
  small: 0.75,
  medium: 1,
  large: 2,
  xLarge: 3
};

export const ACTOR_LAYOUT_GROUP_COLORS: Record<
  ActorLayoutGroup,
  {
    fill: string;
    iconClassName: string;
    outline: string;
  }
> = {
  ally: {
    fill: '#16a34a',
    iconClassName: 'text-green-600',
    outline: '#4ade80'
  },
  enemy: {
    fill: '#dc2626',
    iconClassName: 'text-red-600',
    outline: '#ef4444'
  },
  hero: {
    fill: '#2563eb',
    iconClassName: 'text-blue-600',
    outline: '#7dd3fc'
  },
  neutral: {
    fill: '#ca8a04',
    iconClassName: 'text-yellow-600',
    outline: '#facc15'
  }
};
