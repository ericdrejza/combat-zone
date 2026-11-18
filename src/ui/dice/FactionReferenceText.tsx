import { useEffect } from "react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { previewDiceTarget } from "./MentionSuggestions";
import { StaleReference } from "./StaleReference";
import { useTheme } from "@ui/theme/ThemeProvider";
import { actorReferenceColor } from "./actorReferenceColor";
import { useSelectLogReference } from "./useSelectLogReference";
import { useLogReferenceGestures } from "./useLogReferenceGestures";

/** Every faction selector previews/selects actors, including its Zoneless members. */
export function FactionReferenceText({ text, actorIds, stale, color, automaticColor, session }: { text: string; actorIds: string[]; stale: boolean; color: string | null; automaticColor: boolean; session: number }) {
  const select = useSelectLogReference();
  const gestures = useLogReferenceGestures(() => select("actor", actorIds, { group: true }),
    () => select("actor", actorIds, { group: true, navigate: true }), session);
  const { theme } = useTheme();
  const displayColor = automaticColor ? actorReferenceColor(color, theme) : color;
  useEffect(() => () => previewDiceTarget(null), [actorIds.join("\0")]);
  if (stale) return <StaleReference text={text} color={displayColor} />;
  const button = <button type="button" disabled={!actorIds.length}
    title={actorIds.length ? undefined : "No matching actors"}
    className="inline cursor-pointer rounded-sm text-left enabled:hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-50"
    style={actorIds.length ? { color: displayColor ?? "rgb(var(--color-canvas-ink))" } : undefined}
    onMouseEnter={() => { if (actorIds.length) previewDiceTarget(actorIds); }} onMouseLeave={() => previewDiceTarget(null)}
    onFocus={() => previewDiceTarget(actorIds)} onBlur={() => previewDiceTarget(null)}
    {...gestures}>{text}</button>;
  return actorIds.length ? button : <TouchTooltip label="No matching actors">{button}</TouchTooltip>;
}
