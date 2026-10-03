import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { MusicSectionControls, SectionPlaybackButton } from "@ui/audio/AudioTransportControls";
import type { AudioPlaybackScope } from "@ui/audio/audioPlaybackTypes";

/** Disclosure is local UI state; collapsing a section never stops its audio. */
export function AudioPanelSection({ children, label, scope, subsection = false }: { children: ReactNode; label: string; scope: AudioPlaybackScope; subsection?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const Heading = subsection ? "h4" : "h3";
  return <section className="space-y-2">
    <div className={`flex items-center gap-1 ${subsection ? "border-b border-canvas-line pb-1" : ""}`}>
      <Heading className={`mr-auto font-display font-semibold ${subsection ? "text-sm" : "text-base"}`}>{label}</Heading>
      {scope === "music" ? <MusicSectionControls infoFirst /> : <SectionPlaybackButton label={label.toLowerCase()} scope={scope} />}
      <button aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}${subsection ? " subsection" : ""}`} aria-expanded={!collapsed} className="flex h-8 w-8 items-center justify-center rounded-full" onClick={() => setCollapsed(!collapsed)} type="button">{collapsed ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}</button>
    </div>
    {collapsed ? null : children}
  </section>;
}
