import type { LayoutStrategyId } from "../../core/layout/types";

export type Engagement = {
  id: string;
  participantIds: string[];
  parentZoneId: string;
  layoutStrategy: Extract<LayoutStrategyId, "FLEX" | "SEQUENTIAL">;
};
