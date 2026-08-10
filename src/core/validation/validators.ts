import type { EncounterState } from "@core/encounter/types";
import { PolygonPlacementValidator } from "./polygonFlexPlacementValidator";
import type { Validator } from "./types";
import { ZoneOverlapValidator } from "./zoneOverlapValidator";
import { CanvasBoundsValidator } from "./canvasBoundsValidator";
import { EdgeRouteDiagnosticValidator, EdgeValidator } from "./edgeValidators";
import { EngagementValidator } from "./engagementValidator";
import { MovementValidator } from "./movementValidator";
import { ZoneIntegrityValidator } from "./zoneIntegrityValidator";
import { ZoneSizeValidator } from "./zoneSizeValidator";

export {
  CanvasBoundsValidator,
  EdgeRouteDiagnosticValidator,
  EdgeValidator,
  EngagementValidator,
  MovementValidator,
  ZoneIntegrityValidator,
  ZoneSizeValidator
};

export const MVP_VALIDATORS: Validator<EncounterState>[] = [
  MovementValidator,
  ZoneSizeValidator,
  ZoneOverlapValidator,
  PolygonPlacementValidator,
  EdgeValidator,
  EdgeRouteDiagnosticValidator,
  EngagementValidator,
  ZoneIntegrityValidator,
  CanvasBoundsValidator
];
