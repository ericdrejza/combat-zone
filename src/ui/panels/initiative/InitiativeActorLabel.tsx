import { useLayoutEffect, useRef, useState } from "react";
import type { Actor } from "@entities/actor/types";
import { CONDITIONS } from "@ui/status/markerCatalog";
import { InitiativeConditionIcons } from "./InitiativeConditionIcons";

/** Measures the name and complete icon strip in the row's owning window. */
export function InitiativeActorLabel({ actor, selected, strikethrough }: { actor: Actor; selected: boolean; strikethrough: boolean }) {
  const conditions = CONDITIONS.filter(({ id }) => actor.statusEffects.includes(id));
  const root = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const measureIcons = useRef<HTMLSpanElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const conditionIds = conditions.map(({ id }) => id).join("|");
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let canceled = false;
    const measure = () => {
      if (canceled) return;
      const width = element.clientWidth;
      const gap = Number.parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).columnGap ?? "") || 8;
      setCollapsed(width > 0 && conditions.length > 0 && (name.current?.scrollWidth ?? 0) + (measureIcons.current?.scrollWidth ?? 0) + gap > width);
    };
    measure();
    const ownerWindow = element.ownerDocument.defaultView;
    const Observer = ownerWindow?.ResizeObserver ?? globalThis.ResizeObserver;
    const observer = Observer ? new Observer(measure) : null;
    observer?.observe(element);
    if (name.current) observer?.observe(name.current);
    if (measureIcons.current) observer?.observe(measureIcons.current);
    ownerWindow?.addEventListener("resize", measure);
    void element.ownerDocument.fonts?.ready.then(measure);
    return () => { canceled = true; observer?.disconnect(); ownerWindow?.removeEventListener("resize", measure); };
  }, [actor.name, conditionIds, selected, strikethrough]);
  return <span className="relative flex min-w-0 flex-1 items-center gap-2" ref={root}>
    <span className={`min-w-0 truncate ${selected ? "font-bold" : "font-medium"}`} ref={name}>
      {strikethrough ? <s>{actor.name}</s> : actor.name}
    </span>
    <span aria-hidden="true" className="pointer-events-none invisible absolute flex w-max gap-1" ref={measureIcons}>
      {conditions.map(({ id, Icon }) => <Icon aria-hidden="true" className="h-4 w-4 shrink-0" key={id} />)}
    </span>
    <InitiativeConditionIcons actorId={actor.id} actorName={actor.name} conditions={conditions} collapsed={collapsed} />
  </span>;
}
