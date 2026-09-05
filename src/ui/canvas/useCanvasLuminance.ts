import { useEffect, useState } from "react";

import type { LayoutPoint } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
import type { RootState } from "@store/store";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { BACKGROUND_SAMPLE_COUNT } from "./canvasConstants";
import {
  createDeterministicSamplePoints,
  drawCanvasBackgroundImage,
  getAverageCanvasLuminance,
  getFallbackCanvasLuminance,
  getImageLuminanceFallback,
  sampleCanvasBackgroundLuminance,
  sampleZoneBackgroundLuminance,
  usesBackgroundLuminanceForZoneName
} from "./canvasLuminance";

type BackgroundImage = RootState["encounter"]["present"]["backgroundImage"];
type ZoneCollection = RootState["encounter"]["present"]["zones"];

export type CanvasBackgroundLuminance = {
  byZoneId: Record<string, number>;
  canvas: number;
};

export function useCanvasBackgroundLuminance(
  backgroundImage: BackgroundImage,
  zones: ZoneCollection,
  canvasSize: CanvasSize
): CanvasBackgroundLuminance {
  const fallbackLuminance = getImageLuminanceFallback(
    backgroundImage?.source
  );
  const sourceUrl = useResolvedImageSource(backgroundImage?.source);
  const [backgroundLuminance, setBackgroundLuminance] =
    useState<CanvasBackgroundLuminance>({
      byZoneId: {},
      canvas: fallbackLuminance
    });

  useEffect(() => {
    const backgroundTextZones = zones.allIds
      .map((zoneId) => zones.byId[zoneId])
      .filter(
        (zone): zone is Zone =>
          Boolean(zone) && usesBackgroundLuminanceForZoneName(zone)
      );

    const fallbackByZoneId = Object.fromEntries(
      backgroundTextZones.map((zone) => [zone.id, fallbackLuminance])
    );

    if (!backgroundImage) {
      setBackgroundLuminance({
        byZoneId: fallbackByZoneId,
        canvas: fallbackLuminance
      });
      return;
    }

    let cancelled = false;
    const image = new Image();
    // Allow CORS-enabled URL images to remain readable by the luminance
    // canvas. Embedded and blob-backed images are unaffected by this flag.
    image.crossOrigin = "anonymous";

    image.addEventListener("error", () => {
      if (!cancelled) {
        setBackgroundLuminance({
          byZoneId: fallbackByZoneId,
          canvas: fallbackLuminance
        });
      }
    });

    image.addEventListener("load", () => {
      if (cancelled) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        setBackgroundLuminance({
          byZoneId: fallbackByZoneId,
          canvas: fallbackLuminance
        });
        return;
      }

      try {
        drawCanvasBackgroundImage(context, image, canvasSize);
        const luminanceByZoneId = Object.fromEntries(
          backgroundTextZones.map((zone) => [
            zone.id,
            sampleZoneBackgroundLuminance(context, zone, canvasSize)
          ])
        );

        setBackgroundLuminance({
          byZoneId: luminanceByZoneId,
          canvas: sampleCanvasBackgroundLuminance(context, canvasSize)
        });
      } catch {
        // Remote hosts may allow display while blocking cross-origin pixel reads.
        setBackgroundLuminance({
          byZoneId: fallbackByZoneId,
          canvas: fallbackLuminance
        });
      }
    });
    if (!sourceUrl) return;
    image.src = sourceUrl;

    return () => {
      cancelled = true;
    };
  }, [backgroundImage, canvasSize, sourceUrl, zones.allIds, zones.byId]);

  return backgroundLuminance;
}

export function usePolygonDraftBackgroundLuminance(
  backgroundImage: BackgroundImage,
  zoneDraftPoints: LayoutPoint[],
  canvasSize: CanvasSize
): number {
  const sourceUrl = useResolvedImageSource(backgroundImage?.source);
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
    const fallbackLuminance = getImageLuminanceFallback(
      backgroundImage.source
    );
    image.crossOrigin = "anonymous";

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
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        setPolygonDraftBackgroundLuminance(fallbackLuminance);
        return;
      }

      try {
        drawCanvasBackgroundImage(context, image, canvasSize);
        const samplePoints =
          zoneDraftPoints.length >= 3
            ? createDeterministicSamplePoints(
                zoneDraftPoints,
                BACKGROUND_SAMPLE_COUNT
              )
            : zoneDraftPoints;
        setPolygonDraftBackgroundLuminance(
          getAverageCanvasLuminance(context, samplePoints, canvasSize)
        );
      } catch {
        setPolygonDraftBackgroundLuminance(fallbackLuminance);
      }
    });
    if (!sourceUrl) return;
    image.src = sourceUrl;

    return () => {
      cancelled = true;
    };
  }, [backgroundImage, canvasSize, sourceUrl, zoneDraftPoints]);

  return polygonDraftBackgroundLuminance;
}
