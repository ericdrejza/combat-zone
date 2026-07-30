export type RenderLayer =
  | 'background'
  | 'zones'
  | 'edges'
  | 'engagements'
  | 'actors'
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
  { id: 'engagements', label: 'Engagements' },
  { id: 'actors', label: 'actors' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'uiOverlays', label: 'UI overlays' }
];
