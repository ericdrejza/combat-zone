export type LayoutStrategyId =
  | 'FLEX'
  | 'SEQUENTIAL'
  | 'SPLIT_FLEX'
  | 'SPLIT_SEQUENTIAL';
export type LayoutComputationStrategy = 'LAZY' | 'PROACTIVE';
export type LayoutOrientation = 'LEFT_RIGHT' | 'TOP_BOTTOM';

export type LayoutPoint = {
  x: number;
  y: number;
};

export type LayoutEntity<TEntityId extends string = string> = {
  id: TEntityId;
  layoutGroup?: 'hero' | 'enemy' | 'neutral';
};

export type LayoutSectionId = string;

export type LayoutSection<TEntityId extends string = string> = {
  id: LayoutSectionId;
  className: string;
  items: LayoutEntity<TEntityId>[];
};

export type LayoutDescriptor<TEntityId extends string = string> = {
  strategy: LayoutStrategyId;
  orientation: LayoutOrientation;
  className: string;
  sections: LayoutSection<TEntityId>[];
};

export type LayoutStrategyInput<TEntityId extends string = string> = {
  entities: LayoutEntity<TEntityId>[];
  orientation: LayoutOrientation;
};

export type LayoutStrategy<TEntityId extends string = string> = {
  id: LayoutStrategyId;
  describe(input: LayoutStrategyInput<TEntityId>): LayoutDescriptor<TEntityId>;
};
