import { useEffect, useState } from "react";

import type { LayoutPoint } from "../../core/layout/types";
import type { Zone } from "../../entities/zone/types";
import type { RootState } from "../../store/store";
import {
  BACKGROUND_SAMPLE_COUNT,
  CANVAS_HEIGHT,
  CANVAS_WIDTH
} from "./canvasConstants";
import {
  createDeterministicSamplePoints,
  drawCanvasBackgroundImage,
  getAverageCanvasLuminance,
  getFallbackCanvasLuminance,
  sampleZoneBackgroundLuminance,
  usesBackgroundLuminanceForZoneName
} from "./canvasLuminance";

type BackgroundImage = RootState["encounter"]["present"]["backgroundImage"];
type ZoneCollection = RootState["encounter"]["present"]["zones"];

export function useBackgroundLuminanceByZoneId(
  backgroundImage: BackgroundImage,
  zones: ZoneCollection
): Record<string, number> {
  const [backgroundLuminanceByZoneId, setBackgroundLuminanceByZoneId] =
    useState<Record<string, number>>({});

  useEffect(() => {
    const backgroundTextZones = zones.allIds
      .map((zoneId) => zones.byId[zoneId])
      .filter(
        (zone): zone is Zone =>
          Boolean(zone) && usesBackgroundLuminanceForZoneName(zone)
      );

    if (backgroundTextZones.length === 0) {
      setBackgroundLuminanceByZoneId({});
      return;
    }

    const fallbackLuminance = getFallbackCanvasLuminance();

    if (!backgroundImage) {
      setBackgroundLuminanceByZoneId(
        Object.fromEntries(
          backgroundTextZones.map((zone) => [zone.id, fallbackLuminance])
        )
      );
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.addEventListener("error", () => {
      if (!cancelled) {
        setBackgroundLuminanceByZoneId(
          Object.fromEntries(
            backgroundTextZones.map((zone) => [zone.id, fallbackLuminance])
          )
        );
      }
    });

    image.addEventListener("load", () => {
      if (cancelled) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        return;
      }

      drawCanvasBackgroundImage(context, image);

      const luminanceByZoneId = Object.fromEntries(
        backgroundTextZones.map((zone) => [
          zone.id,
          sampleZoneBackgroundLuminance(context, zone)
        ])
      );

      if (!cancelled) {
        setBackgroundLuminanceByZoneId(luminanceByZoneId);
      }
    });
    image.src = backgroundImage.dataUrl;

    return () => {
      cancelled = true;
    };
  }, [backgroundImage, zones.allIds, zones.byId]);

  return backgroundLuminanceByZoneId;
}

export function usePolygonDraftBackgroundLuminance(
  backgroundImage: BackgroundImage,
  zoneDraftPoints: LayoutPoint[]
): number {
  const [polygonDraftBackgroundLuminance, setPolygonDraftBackgroundLuminance] =
    useState(getFallbackCanvasLuminance());

  useEffect(() => {
    if (zoneDraftPoints.length === 0) {
      setPolygonDraftBackgroundLuminance(getFallbackCanvasLuminance());
      return;
    }

    if (!backgroundImage) {
      setPolygonDraftBackgroundLuminance(getFallbackCanvasLuminance());
      return;
    }

    let cancelled = false;
    const image = new Image();
    const fallbackLuminance = getFallbackCanvasLuminance();

    image.addEventListener("error", () => {
      if (!cancelled) {
        setPolygonDraftBackgroundLuminance(fallbackLuminance);
      }
    });

    image.addEventListener("load", () => {
      if (cancelled) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        setPolygonDraftBackgroundLuminance(fallbackLuminance);
        return;
      }

      drawCanvasBackgroundImage(context, image);

      const samplePoints =
        zoneDraftPoints.length >= 3
          ? createDeterministicSamplePoints(zoneDraftPoints, BACKGROUND_SAMPLE_COUNT)
          : zoneDraftPoints;
      const luminance = getAverageCanvasLuminance(context, samplePoints);

      if (!cancelled) {
        setPolygonDraftBackgroundLuminance(luminance);
      }
    });
    image.src = backgroundImage.dataUrl;

    return () => {
      cancelled = true;
    };
  }, [backgroundImage, zoneDraftPoints]);

  return polygonDraftBackgroundLuminance;
}
