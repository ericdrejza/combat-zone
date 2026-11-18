import { useEffect, type ReactNode } from "react";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "@store/store";
import type { ChatReference } from "@core/chat/types";
import { referencePreviewActorIds } from "@core/dice/referencePreview";
import { previewDiceTarget } from "./MentionSuggestions";
import { StaleReference } from "./StaleReference";
import { useTheme } from "@ui/theme/ThemeProvider";
import { actorReferenceColor } from "./actorReferenceColor";
import { factionSelectors } from "@core/dice/factionSelectors";
import { FactionReferenceText } from "./FactionReferenceText";
import { useSelectLogReference } from "./useSelectLogReference";
import { useLogReferenceGestures } from "./useLogReferenceGestures";

/** Saved identities survive renames; previews use only entities still on the canvas. */
function ReferenceText({ reference, text, message, references, session }: { reference: ChatReference; text: string; message: string; references: ChatReference[]; session: number }) {
  const store = useStore<RootState>();
  const select = useSelectLogReference();
  const gestures = useLogReferenceGestures(() => select(reference.kind, [reference.entityId]),
    () => select(reference.kind, [reference.entityId], { navigate: true }), session);
  const { theme } = useTheme();
  const color = reference.kind === "actor" ? actorReferenceColor(reference.color, theme) : reference.color;
  const exists = useSelector((state: RootState) => !!(reference.kind === "actor" ? state.encounter.present.actors : state.encounter.present.zones).byId[reference.entityId]);
  useEffect(() => () => previewDiceTarget(null), [exists]);
  function preview() {
    const state = store.getState().encounter.present;
    if (reference.kind === "actor") {
      previewDiceTarget(state.actors.byId[reference.entityId] ? reference.entityId : null);
      return;
    }
    previewDiceTarget(state.zones.byId[reference.entityId] ? referencePreviewActorIds(state, message, references, reference) : []);
  }
  if (!exists) return <StaleReference text={text} color={color} />;
  return <button type="button" className="inline cursor-pointer rounded-sm text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink" style={{ color: color ?? "rgb(var(--color-canvas-ink))" }}
    onMouseEnter={preview} onMouseLeave={() => previewDiceTarget(null)} onFocus={preview} onBlur={() => previewDiceTarget(null)}
    {...gestures}>{text}</button>;
}
/** Render only validated display spans; React escapes all submitted text. */
export function ChatMessageText({ message, references = [] }: { message: string; references?: ChatReference[] }) {
  const state = useSelector((state: RootState) => state.encounter.present);
  const session = useSelector((state: RootState) => state.encounterLog.encounterSession);
  const factions = factionSelectors(state, message, references);
  const spans = [...references.filter(reference => !factions.some(faction => faction.start === reference.start && faction.end === reference.end))
    .map(reference => ({ start: reference.start, end: reference.end, reference })),
    ...factions.map(faction => ({ start: faction.start, end: faction.end, faction }))].sort((a, b) => a.start - b.start);
  const content: ReactNode[] = [];
  let position = 0;
  for (const span of spans) {
    content.push(message.slice(position, span.start));
    content.push("reference" in span
      ? <ReferenceText key={span.start} reference={span.reference} text={message.slice(span.start, span.end)} message={message} references={references} session={session} />
      : <FactionReferenceText key={span.start} {...span.faction} text={message.slice(span.start, span.end)} session={session} />);
    position = span.end;
  }
  content.push(message.slice(position));
  return <>{content}</>;
}
