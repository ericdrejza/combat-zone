import { useEffect, useId, useRef, useState } from "react";
import type DiceBoxType from "@3d-dice/dice-box";
import type { DiceResult } from "@core/dice/types";
import { evaluatePhysicalDice } from "@core/dice/physicalDice";
import { registerDiceTray } from "./diceTrayBridge";
const SUPPORTED = new Set([4, 6, 8, 10, 12, 20, 100]);

/** Own the imperative renderer outside CanvasShell; do not put its canvas inside encounter SVG. */
export function DiceTray() {
  const hostId = `dice-tray-${useId().replace(/:/g, "")}`;
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<DiceBoxType | null>(null);
  useEffect(() => {
    let alive = true, running = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const unregister = registerDiceTray(async (formulas, signal) => {
      if (running) throw new Error("The 3D tray is busy.");
      running = true;
      let cancelled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      try {
      const [{ default: DiceBox }, { default: DiceParser }] = await Promise.all([import("@3d-dice/dice-box"), import("@3d-dice/dice-parser-interface")]);
      const parser = new DiceParser();
      for (const formula of formulas) {
        const groups = parser.parseNotation(formula.replace(/~\d+/g, ""));
        if (groups.some(g => !SUPPORTED.has(Number(g.sides)) || !Number.isSafeInteger(g.qty) || g.qty < 1) || groups.reduce((n, g) => n + g.qty, 0) > 100) throw new Error("This formula or die uses text presentation.");
      }
      if (!alive || signal.aborted) throw new Error("Roll cancelled.");
      clearTimeout(hideTimer); setVisible(true);
        const work = async () => {
          const probe = document.createElement("canvas");
          if (!probe.getContext("webgl2") && !probe.getContext("webgl")) throw new Error("WebGL is unavailable.");
          if (!box.current) {
            const instance = new DiceBox({ container: `#${hostId}`, id: `${hostId}-canvas`, assetPath: `${import.meta.env.BASE_URL}dice-assets/`, offscreen: false, enableShadows: false, scale: 5 });
            box.current = instance;
            await instance.init();
            if (cancelled || !alive || signal.aborted) { instance.clear(); instance.hide(); throw new Error("Roll cancelled."); }
            instance.canvas.style.width = "100%"; instance.canvas.style.height = "100%";
          }
          const renderer = box.current;
          renderer.clear(); renderer.show();
          const results: DiceResult[] = [];
          for (const formula of formulas) results.push(await evaluatePhysicalDice(formula, async sides => {
            if (cancelled || !alive || signal.aborted) throw new Error("Roll cancelled.");
            if (!SUPPORTED.has(sides)) throw new Error("This die uses text presentation.");
            const [face] = await renderer.add({ qty: 1, sides });
            if (cancelled || !alive || signal.aborted) throw new Error("Roll cancelled.");
            if (!face || !Number.isSafeInteger(face.value) || face.value < 1 || face.value > sides) throw new Error("3D returned an invalid face.");
            return face.value;
          }, signal));
          return results;
        };
        return await Promise.race([work(), new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("3D roll timed out.")), 20000);
          abort = () => reject(new Error("Roll cancelled.")); signal.addEventListener("abort", abort, { once: true });
        })]);
      } catch (error) {
        try { box.current?.clear(); box.current?.hide(); } catch { box.current?.canvas?.remove(); box.current = null; }
        if (alive) setVisible(false); throw error;
      }
      finally {
        cancelled = true;
        clearTimeout(timeout); if (abort) signal.removeEventListener("abort", abort);
        running = false;
        hideTimer = setTimeout(() => { if (alive) { box.current?.hide(); setVisible(false); } }, 1500);
      }
    });
    return () => { alive = false; unregister(); clearTimeout(hideTimer); box.current?.clear(); box.current?.hide(); box.current = null; };
  }, [hostId]);
  return <div aria-label="3D dice tray" aria-hidden={!visible} className={`pointer-events-none absolute inset-0 z-40 ${visible ? "" : "invisible"}`}><div ref={host} id={hostId} className="h-full w-full" /></div>;
}
