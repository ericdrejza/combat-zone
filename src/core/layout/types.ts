export type LayoutStrategyId = "FLEX" | "SEQUENTIAL" | "SPLIT_SEQUENTIAL";

export type LayoutPoint = {
  x: number;
  y: number;
};

export type LayoutResult<TEntityId extends string = string> = Record<
  TEntityId,
  LayoutPoint
>;
