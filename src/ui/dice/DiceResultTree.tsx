import { DiceFaceImage } from "./DiceFaceImage";
import type { DiceNode } from "@core/dice/types";

/** Render the normalized tree, preserving group drops and arithmetic instead of flattening away meaning. */
export function DiceResultTree({ node, image = false, root = true }: { node: DiceNode; image?: boolean; root?: boolean }) {
  const face = node.face;
  const isFunction = node.type === "mathfunction";
  const showParentheses = isFunction || !root;
  const state = node.dropped ? "dropped" : node.rerolled && !node.valid ? "rerolled" : "kept";
  const extreme = node.critical ?? (face !== undefined ? node.type === "fateroll" ? face === -1 ? "failure" : face === 1 ? "success" : null : face === 1 ? "failure" : face === node.sides ? "success" : null : null);
  const style = extreme === "success" ? "border-green-600 text-green-700 dark:text-green-400" : extreme === "failure" ? "border-red-600 text-red-700 dark:text-red-400" : "border-canvas-line";
  return <span className={`inline-flex max-w-full flex-wrap items-center gap-1 ${!node.valid ? "opacity-50" : ""}`}>
    {node.parameters?.count ? <span>count=<DiceResultTree node={node.parameters.count} image={image} /></span> : null}
    {node.parameters?.sides ? <span>sides=<DiceResultTree node={node.parameters.sides} image={image} /></span> : null}
    {node.label ? <span className="break-words">{node.label}:</span> : null}
    {face !== undefined && !node.children ? <span title={`${node.type === "fateroll" ? "Fate" : `d${node.sides}`}: ${face}, ${state}${extreme ? `, ${extreme}` : ""}`} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${style} ${image ? "min-h-9 min-w-9 justify-center bg-canvas-surface" : ""} ${!node.valid ? "line-through" : ""}`}>
      {image ? <DiceFaceImage face={face} sides={node.sides ?? 6} /> : node.type === "fateroll" ? face > 0 ? "+1" : face : face}<span className="sr-only"> {state}{extreme ? `, ${extreme}` : ""}</span>{node.exploded ? <span aria-label="Exploded">!</span> : null}{node.matched ? <span>match</span> : null}{node.capped ? <span>cap</span> : null}
    </span> : node.children ? <span className={`inline-flex max-w-full flex-wrap items-center gap-1 ${node.dropped ? "line-through" : ""}`}>
      {showParentheses ? <span>{isFunction ? `${node.operators?.[0]}(` : "("}</span> : null}
      {node.children.map((child, i) => <span key={i} className="inline-flex max-w-full flex-wrap items-center gap-1">{i > 0 ? <span>{node.operators?.[i - 1] ?? (node.type === "grouproll" ? "," : "+")}</span> : null}<DiceResultTree node={child} image={image} root={root && !isFunction && node.children!.length === 1} /></span>)}{showParentheses ? <span>)</span> : null}{node.dropped ? <span>dropped</span> : null}
    </span> : <span>{node.value}</span>}
  </span>;
}
