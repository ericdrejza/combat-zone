import { createContext, useContext, useLayoutEffect, useState, useId, type PropsWithChildren, type ReactNode } from 'react';

type Layer = 'canvas' | 'rulers';
type Layers = Partial<Record<Layer, ReactNode>>;
const SourceContext = createContext<(layer: Layer, scene: ReactNode) => void>(() => {});
const SceneContext = createContext<Layers>({});
const AudienceContext = createContext(false);
const SceneIdContext = createContext('');

/** Render snapshots contain no durable facts; the mounted GM controller owns live gestures. */
export function PlayerSceneProvider({ children }: PropsWithChildren) {
  const [layers, setLayers] = useState<Layers>({});
  const [publish] = useState(() => (layer: Layer, scene: ReactNode) =>
    setLayers(current => current[layer] === scene ? current : { ...current, [layer]: scene }));
  return <SourceContext.Provider value={publish}>
    <SceneContext.Provider value={layers}>{children}</SceneContext.Provider>
  </SourceContext.Provider>;
}

export function PlayerSceneSource({ layer, scene }: { layer: Layer; scene: ReactNode }) {
  const publish = useContext(SourceContext);
  useLayoutEffect(() => { publish(layer, scene); }, [publish, layer, scene]);
  useLayoutEffect(() => () => publish(layer, null), [publish, layer]);
  return <>{scene}</>;
}

/** Separate from the source context so animation/render publications cannot rerender their owner. */
export function PlayerScene() {
  const layers = useContext(SceneContext);
  const id = useId().replace(/:/g, '');
  return <AudienceContext.Provider value={true}><SceneIdContext.Provider value={`player-${id}-`}>
    <g pointerEvents="none" className="[&_*]:pointer-events-none">{layers.canvas}{layers.rulers}</g>
  </SceneIdContext.Provider></AudienceContext.Provider>;
}

export function usePlayerAudience() { return useContext(AudienceContext); }

export function useSceneId(id: string) { return useContext(SceneIdContext) + id; }

export function EditorSceneOnly({ children }: PropsWithChildren) {
  return usePlayerAudience() ? null : <>{children}</>;
}
