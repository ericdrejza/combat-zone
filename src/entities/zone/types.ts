import type { LayoutStrategyId, LayoutPoint } from "../../core/layout/types";

export type Zone = {
  id: string;
  name: string;
  polygon: LayoutPoint[];
  layoutStrategy: Extract<LayoutStrategyId, "FLEX" | "SEQUENTIAL" | "SPLIT_SEQUENTIAL">;
  tags: string[];
};
