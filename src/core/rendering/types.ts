export type RenderLayer =
  | "background"
  | "zones"
  | "edges"
  | "freeFloatingActors"
  | "engagementOverlays"
  | "annotations"
  | "uiOverlays";

export type RenderLayerDefinition = {
  id: RenderLayer;
  label: string;
};

export const RENDER_LAYERS: RenderLayerDefinition[] = [
  { id: "background", label: "Background" },
  { id: "zones", label: "Zones" },
  { id: "edges", label: "Edges" },
  { id: "freeFloatingActors", label: "Free-floating actors" },
  { id: "engagementOverlays", label: "Engagement overlays" },
  { id: "annotations", label: "Annotations" },
  { id: "uiOverlays", label: "UI overlays" }
];
