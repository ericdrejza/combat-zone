import { motion } from "motion/react";
import type { ReactNode } from "react";
import { focusImageStyle, type ImageFocus } from "@core/assets/imageFocus";

/**
 * Keep the saved square crop intact in rectangular cards. HTML media inside a
 * foreignObject needs a real layout size: a unit-square viewBox rasterizes it
 * at tiny dimensions and rounds crop offsets before scaling the preview up.
 */
export function ImageFocusFrame({ focus, square = false, children }: { focus?: ImageFocus; square?: boolean; children: ReactNode }) {
  if (!focus && !square) return <>{children}</>;
  return <svg className="block h-full w-full" viewBox="0 0 1024 1024">
    <foreignObject x="0" y="0" width="1024" height="1024">
      <span className="relative block h-full w-full overflow-hidden">
        <motion.span className={`block ${focus ? "[&>img]:h-full [&>img]:w-full [&>video]:h-full [&>video]:w-full [&>img]:object-fill [&>video]:object-fill" : "h-full w-full"}`} style={focus ? focusImageStyle(focus) : undefined}>
          {children}
        </motion.span>
      </span>
    </foreignObject>
  </svg>;
}
