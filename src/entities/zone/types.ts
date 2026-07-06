import type {
  LayoutOrientation,
  LayoutPoint,
  LayoutStrategyId
} from "../../core/layout/types";

export type Zone = {
  id: string;
  name: string;
  polygon: LayoutPoint[];
  layoutStrategy: Extract<LayoutStrategyId, "FLEX" | "SEQUENTIAL" | "SPLIT_SEQUENTIAL">;
  layoutOrientation: LayoutOrientation;
  tags: string[];
};
