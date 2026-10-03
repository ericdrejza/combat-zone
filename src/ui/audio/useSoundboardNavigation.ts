import { animate } from "motion/react";
import { useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";

import type { EncounterState } from "@core/encounter/types";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
import type { SoundboardNavigationRequest } from "./soundboardNavigation";

type Options = {
  navigation?: SoundboardNavigationRequest | null;
  encounter: EncounterState;
  scrollRef: RefObject<HTMLDivElement>;
  collapsedSections: Set<string>;
  collapsedGroups: Set<string>;
  setCollapsedSections: Dispatch<SetStateAction<Set<string>>>;
  setCollapsedGroups: Dispatch<SetStateAction<Set<string>>>;
};

/** Resolves entity assignments at launch time; navigation never changes encounter history. */
export function useSoundboardNavigation({ navigation, encounter, scrollRef, collapsedSections, collapsedGroups, setCollapsedSections, setCollapsedGroups }: Options) {
  const handled = useRef<SoundboardNavigationRequest | null>(null);
  const { animationsDisabled } = useMotionPreference();

  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root || !navigation || handled.current === navigation) return;
    const entity = navigation.entityType === "actor"
      ? encounter.actors.byId[navigation.entityId]
      : encounter.zones.byId[navigation.entityId];
    const groupIds = (entity?.audioGroupIds ?? []).filter((id) => encounter.audioCueGroups.byId[id]?.section === navigation.entityType);
    const sectionCollapsed = collapsedSections.has(navigation.entityType);
    const groupsCollapsed = groupIds.some((id) => collapsedGroups.has(id));
    if (sectionCollapsed || groupsCollapsed) {
      if (sectionCollapsed) setCollapsedSections((current) => { const next = new Set(current); next.delete(navigation.entityType); return next; });
      if (groupsCollapsed) setCollapsedGroups((current) => { const next = new Set(current); groupIds.forEach((id) => next.delete(id)); return next; });
      return; // Scroll only after the expanded group has mounted.
    }
    const group = Array.from(root.querySelectorAll<HTMLElement>("[data-audio-group-id]")).find((element) => element.dataset.audioGroupId === groupIds[0]);
    const section = Array.from(root.querySelectorAll<HTMLElement>("[data-audio-section-id]")).find((element) => element.dataset.audioSectionId === navigation.entityType);
    const target = group ?? section;
    if (!target) return;
    handled.current = navigation;
    const headerHeight = root.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const destination = Math.min(Math.max(0, root.scrollHeight - root.clientHeight), Math.max(0, root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - headerHeight - 12));
    if (animationsDisabled) { root.scrollTop = destination; return; }
    let completed = false;
    const animation = animate(root.scrollTop, destination, {
      duration: 0.2,
      ease: "easeOut",
      onUpdate: (value) => { root.scrollTop = value; },
      onComplete: () => { completed = true; }
    });
    return () => {
      animation.stop();
      // StrictMode replays mount effects before the first animation frame.
      // An interrupted request must remain eligible for the next setup.
      if (!completed && handled.current === navigation) handled.current = null;
    };
  }, [navigation, encounter, scrollRef, collapsedSections, collapsedGroups, setCollapsedSections, setCollapsedGroups, animationsDisabled]);
}
