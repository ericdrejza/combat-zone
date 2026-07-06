import type {
  LayoutEntity,
  LayoutDescriptor,
  LayoutSection,
  LayoutStrategy,
  LayoutStrategyId,
  LayoutStrategyInput
} from "./types";

function orientationClassName(orientation: LayoutStrategyInput["orientation"]): string {
  return orientation === "LEFT_RIGHT"
    ? "cz-layout-orientation-left-right"
    : "cz-layout-orientation-top-bottom";
}

function section<TEntityId extends string>(
  id: LayoutSection["id"],
  items: LayoutEntity<TEntityId>[]
): LayoutSection<TEntityId> {
  return {
    id,
    className: `cz-layout-section-${id}`,
    items
  };
}

function groupEntities<TEntityId extends string>(
  entities: LayoutEntity<TEntityId>[]
): Record<"hero" | "enemy" | "neutral", LayoutEntity<TEntityId>[]> {
  return {
    hero: entities.filter((entity) => entity.layoutGroup === "hero"),
    enemy: entities.filter((entity) => entity.layoutGroup === "enemy"),
    neutral: entities.filter(
      (entity) => !entity.layoutGroup || entity.layoutGroup === "neutral"
    )
  };
}

function describeSingleSection<TEntityId extends string>(
  strategy: Extract<LayoutStrategyId, "FLEX" | "SEQUENTIAL">,
  {
    entities,
    orientation
  }: LayoutStrategyInput<TEntityId>
): LayoutDescriptor<TEntityId> {
  return {
    strategy,
    orientation,
    className: `cz-layout cz-layout-${strategy.toLowerCase()} ${orientationClassName(
      orientation
    )}`,
    sections: [section("all", entities)]
  };
}

function describeSplitSequential<TEntityId extends string>({
  entities,
  orientation
}: LayoutStrategyInput<TEntityId>): LayoutDescriptor<TEntityId> {
  const groups = groupEntities(entities);

  return {
    strategy: "SPLIT_SEQUENTIAL",
    orientation,
    className: `cz-layout cz-layout-split-sequential ${orientationClassName(
      orientation
    )}`,
    sections: [
      section("hero", groups.hero),
      section("neutral", groups.neutral),
      section("enemy", groups.enemy)
    ]
  };
}

export const layoutStrategies: Record<LayoutStrategyId, LayoutStrategy> = {
  FLEX: {
    id: "FLEX",
    describe: (input) => describeSingleSection("FLEX", input)
  },
  SEQUENTIAL: {
    id: "SEQUENTIAL",
    describe: (input) => describeSingleSection("SEQUENTIAL", input)
  },
  SPLIT_SEQUENTIAL: {
    id: "SPLIT_SEQUENTIAL",
    describe: describeSplitSequential
  }
};

export function getLayoutStrategy(id: LayoutStrategyId): LayoutStrategy {
  return layoutStrategies[id];
}
