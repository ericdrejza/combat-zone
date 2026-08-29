import { TriangleAlert } from "lucide-react";

import { useMotionPreference } from "../motion_preferences/MotionPreferenceProvider";

export function MotionPreferenceWarning() {
  const { animationsDisabled, enableAnimations } = useMotionPreference();

  if (!animationsDisabled) {
    return null;
  }

  return (
    <button
      aria-label="Animations are disabled. Enable animations"
      className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-500/70 bg-amber-100 text-amber-800 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
      onClick={enableAnimations}
      title="Your system preference disables animation effects. Click to enable animations in Combat Zone."
      type="button"
    >
      <TriangleAlert aria-hidden="true" size={20} strokeWidth={2.25} />
    </button>
  );
}
