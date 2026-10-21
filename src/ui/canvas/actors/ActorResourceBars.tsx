import { resourceBarFill } from "@ui/interface_preferences/resourceBarColors";
import { motion, type Transition } from "motion/react";
import type { Actor } from "@entities/actor/types";
import { actorResourceBars, resolvedResourceBars } from "@entities/actor/resourceBars";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";

/** Selected tokens expose bar hover labels while the labels remain outside hit testing. */
export function ActorResourceBars({ actor, radius, top, transition, selected, textColor }: {
  actor: Actor; radius: number; top: number; transition: Transition; selected: boolean; textColor: string;
}) {
  const { resourceBar1Color, resourceBar2Color, resourceBar1Gradient, resourceBar2Gradient, healthCounterName } = useInterfacePreferences();
  const bars = resolvedResourceBars(actor);
  const mapping = actorResourceBars(actor);
  return <g pointerEvents="none">
    {bars.map((bar, index) => {
      const name = mapping[bar.slot]?.kind === "health" ? healthCounterName : bar.name;
      return <motion.g key={bar.slot} initial={false} className="group/resource-bar" pointerEvents={selected ? "visiblePainted" : "none"}
      animate={{ x: -radius, y: top + index * 7 }} transition={transition}
      role="progressbar" aria-label={`${actor.name}: ${name} (Resource ${bar.slot === "first" ? 1 : 2})`}
      aria-valuemin={0} aria-valuemax={bar.maximum} aria-valuenow={Math.max(0, Math.min(bar.maximum, bar.value))}
      aria-valuetext={`${bar.value} / ${bar.maximum}`}>
      <title>{name}: {bar.value} / {bar.maximum}</title>
      <motion.rect height={5} rx={2} fill="#1f2937" stroke="#ffffff" strokeWidth={0.5}
        initial={false} animate={{ width: radius * 2 }} transition={transition} />
      <motion.rect height={5} rx={2} fill={bar.slot === "first" ? resourceBarFill(resourceBar1Color, resourceBar1Gradient, bar.fraction) : resourceBarFill(resourceBar2Color, resourceBar2Gradient, bar.fraction)}
        initial={false} animate={{ width: radius * 2 * bar.fraction }} transition={transition} />
      {selected ? <text x={-5} y={2.5} textAnchor="end" dominantBaseline="middle"
        pointerEvents="none" fill={textColor} strokeWidth={3} paintOrder="stroke"
        className="hidden stroke-canvas-panel text-[8px] font-semibold group-hover/resource-bar:block">
        {name}
      </text> : null}
    </motion.g>;
    })}
  </g>;
}
