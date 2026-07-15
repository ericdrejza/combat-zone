import type {
  LayoutOrientation,
  LayoutPoint,
  LayoutStrategyId
} from "@core/layout/types";

export type ZoneShape = "rectangle" | "circle" | "hexagon" | "polygon";
export type ZoneNamePosition =
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left";

export type Zone = {
  colorBorder: string;
  colorFill: string;
  id: string;
  name: string;
  opacity: number;
  polygon: LayoutPoint[];
  showBorder: boolean;
  showName: boolean;
  namePosition: ZoneNamePosition;
  shape: ZoneShape;
  layoutStrategy: Extract<
    LayoutStrategyId,
    "FLEX" | "SEQUENTIAL" | "SPLIT_FLEX" | "SPLIT_SEQUENTIAL"
  >;
  layoutOrientation: LayoutOrientation;
  tags: string[];
};
