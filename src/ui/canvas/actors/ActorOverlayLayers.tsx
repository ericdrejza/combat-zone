import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, type MotionValue } from "motion/react";

type OverlayTargets = { below: SVGGElement | null; above: SVGGElement | null };
const LayerContext = createContext<OverlayTargets | null>(null);
const PositionContext = createContext<{ x: MotionValue<number>; y: MotionValue<number> } | null>(null);

/** SVG paint order keeps unselected labels behind tokens and selected labels above them. */
export function ActorOverlayLayers({ children }: { children: ReactNode }) {
  const [below, setBelow] = useState<SVGGElement | null>(null);
  const [above, setAbove] = useState<SVGGElement | null>(null);
  return <LayerContext.Provider value={{ below, above }}>
    <g ref={setBelow} aria-label="Unselected actor overlays" />
    {children}
    <g ref={setAbove} aria-label="Selected actor overlays" />
  </LayerContext.Provider>;
}

/** Share the token's live Motion coordinates, including pointer-driven dragging, with its overlays. */
export function ActorMotionGroup({ children, ...props }: ComponentProps<typeof motion.g>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  return <PositionContext.Provider value={{ x, y }}>
    <motion.g {...props} style={{ ...props.style, x, y }}>{children}</motion.g>
  </PositionContext.Provider>;
}

export function ActorOverlay({ selected, children, hidden }: { selected: boolean; children: ReactNode; hidden?: boolean }) {
  const targets = useContext(LayerContext);
  const position = useContext(PositionContext);
  if (!targets || !position) return <>{children}</>;
  const target = selected ? targets.above : targets.below;
  // Wait for the layer refs rather than briefly painting at the token's stacking level.
  return target ? createPortal(
    <motion.g initial={false} inherit={false} style={position} visibility={hidden ? "hidden" : undefined}>{children}</motion.g>, target
  ) : null;
}
