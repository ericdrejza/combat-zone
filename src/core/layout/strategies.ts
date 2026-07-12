import type {
  LayoutEntity,
  LayoutDescriptor,
  LayoutSection,
  LayoutStrategy,
  LayoutStrategyId,
  LayoutStrategyInput
} from './types';

function orientationClassName(
  orientation: LayoutStrategyInput['orientation']
): string {
  return orientation === 'LEFT_RIGHT'
    ? 'cz-layout-orientation-left-right'
    : 'cz-layout-orientation-top-bottom';
}

function section<TEntityId extends string>(
  id: LayoutSection['id'],
  items: LayoutEntity<TEntityId>[],
  flex = false
): LayoutSection<TEntityId> {
  return {
    id,
    className: `cz-layout-section-${id}${flex ? ' cz-layout-section-flex' : ''}`,
    items
  };
}

function groupEntities<TEntityId extends string>(
  entities: LayoutEntity<TEntityId>[]
): Record<'hero' | 'enemy' | 'neutral', LayoutEntity<TEntityId>[]> {
  return {
    hero: entities.filter((entity) => entity.layoutGroup === 'hero'),
    enemy: entities.filter((entity) => entity.layoutGroup === 'enemy'),
    neutral: entities.filter(
      (entity) => !entity.layoutGroup || entity.layoutGroup === 'neutral'
    )
  };
}

function describeSingleSection<TEntityId extends string>(
  strategy: Extract<LayoutStrategyId, 'FLEX' | 'SEQUENTIAL'>,
  { entities, orientation }: LayoutStrategyInput<TEntityId>
): LayoutDescriptor<TEntityId> {
  return {
    strategy,
    orientation,
    className: `cz-layout cz-layout-${strategy.toLowerCase()} ${orientationClassName(
      orientation
    )}`,
    sections: [section('all', entities)]
  };
}

function describeSplitSequential<TEntityId extends string>({
  entities,
  orientation
}: LayoutStrategyInput<TEntityId>): LayoutDescriptor<TEntityId> {
  return describeSplit('SPLIT_SEQUENTIAL', entities, orientation);
}

function describeSplitFlex<TEntityId extends string>({
  entities,
  orientation
}: LayoutStrategyInput<TEntityId>): LayoutDescriptor<TEntityId> {
  return describeSplit('SPLIT_FLEX', entities, orientation, true);
}

function describeSplit<TEntityId extends string>(
  strategy: Extract<LayoutStrategyId, 'SPLIT_FLEX' | 'SPLIT_SEQUENTIAL'>,
  entities: LayoutEntity<TEntityId>[],
  orientation: LayoutStrategyInput<TEntityId>['orientation'],
  flex = false
): LayoutDescriptor<TEntityId> {
  const groups = groupEntities(entities);
  const classStrategy = strategy.toLowerCase().replace('_', '-');

  return {
    strategy,
    orientation,
    className: `cz-layout cz-layout-${classStrategy} ${orientationClassName(
      orientation
    )}`,
    sections: [
      section('hero', groups.hero, flex),
      section('neutral', groups.neutral, flex),
      section('enemy', groups.enemy, flex)
    ]
  };
}

export const layoutStrategies: Record<LayoutStrategyId, LayoutStrategy> = {
  FLEX: {
    id: 'FLEX',
    describe: (input) => describeSingleSection('FLEX', input)
  },
  SEQUENTIAL: {
    id: 'SEQUENTIAL',
    describe: (input) => describeSingleSection('SEQUENTIAL', input)
  },
  SPLIT_FLEX: {
    id: 'SPLIT_FLEX',
    describe: describeSplitFlex
  },
  SPLIT_SEQUENTIAL: {
    id: 'SPLIT_SEQUENTIAL',
    describe: describeSplitSequential
  }
};

export function getLayoutStrategy(id: LayoutStrategyId): LayoutStrategy {
  return layoutStrategies[id];
}
