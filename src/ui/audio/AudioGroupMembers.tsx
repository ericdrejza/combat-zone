import { useId, useLayoutEffect, useRef, useState } from "react";

import type { EncounterState } from "@core/encounter/types";
import type { AudioCueGroup } from "@entities/audio/types";
import { chooseMemberSummary, getAudioGroupMemberSummary } from "./audioGroupMembers";
import { AudioGroupMemberTooltip } from "./AudioGroupMemberTooltip";

/** Measures in the owning window so popouts and responsive headers behave alike. */
export function AudioGroupMembers({ encounter, group }: { encounter: EncounterState; group: AudioCueGroup }) {
  const summary = getAudioGroupMemberSummary(encounter, group);
  const root = useRef<HTMLSpanElement>(null);
  const full = useRef<HTMLSpanElement>(null);
  const condensed = useRef<HTMLSpanElement>(null);
  const [mode, setMode] = useState<"full" | "condensed" | "countOnly">("full");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const tooltipId = useId();
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let cancelled = false;
    const measure = () => {
      if (!cancelled) setMode(chooseMemberSummary(element.clientWidth, full.current?.scrollWidth ?? 0, condensed.current?.getBoundingClientRect().width ?? 0));
    };
    measure();
    const ownerWindow = element.ownerDocument.defaultView;
    const Observer = ownerWindow?.ResizeObserver ?? globalThis.ResizeObserver;
    const observer = Observer ? new Observer(measure) : null;
    observer?.observe(element);
    ownerWindow?.addEventListener("resize", measure);
    void element.ownerDocument.fonts?.ready.then(measure);
    return () => { cancelled = true; observer?.disconnect(); ownerWindow?.removeEventListener("resize", measure); };
  }, [summary.full, summary.condensed]);
  if (!summary.count) return null;
  const hidden = mode !== "full";
  const showTooltip = hidden && (hovered || focused);
  return <span aria-label={`Members of ${group.name}`} aria-describedby={showTooltip ? tooltipId : undefined} className="relative min-w-0 max-w-[min(14rem,30%)] shrink text-xs text-canvas-muted" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} ref={root} tabIndex={hidden ? 0 : undefined}>
    <span aria-hidden="true" className="invisible block truncate" ref={full}>{summary.full}</span>
    <span aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap" ref={condensed}>{summary.condensed}</span>
    <span className="absolute inset-0 truncate">{summary[mode]}</span>
    {showTooltip ? <AudioGroupMemberTooltip id={tooltipId} names={summary.names} /> : null}
  </span>;
}
