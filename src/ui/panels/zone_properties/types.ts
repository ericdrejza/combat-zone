import type { Zone } from "@entities/zone/types";

export type CommitZoneProperties = (properties: Partial<Zone>) => void;
