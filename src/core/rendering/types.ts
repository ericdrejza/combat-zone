export type RenderLayer =
  | 'background'
  | 'zones'
  | 'edges'
  | 'actors'
  | 'engagementOverlays'
  | 'annotations'
  | 'uiOverlays';

export type RenderLayerDefinition = {
  id: RenderLayer;
  label: string;
};

export const RENDER_LAYERS: RenderLayerDefinition[] = [
  { id: 'background', label: 'Background' },
  { id: 'zones', label: 'Zones' },
  { id: 'edges', label: 'Edges' },
  { id: 'actors', label: 'actors' },
  { id: 'engagementOverlays', label: 'Engagement overlays' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'uiOverlays', label: 'UI overlays' }
];
