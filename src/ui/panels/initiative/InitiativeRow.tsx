import { ChevronLeft, ChevronRight, GripVertical, Skull } from "lucide-react";
import { Reorder, motion, useDragControls } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent
} from "react";

import { INITIATIVE_MAX, INITIATIVE_MIN } from "@core/encounter/initiativeMutations";
import type { Actor } from "@entities/actor/types";

const activeFactionClasses: Record<Actor["layoutGroup"], string> = {
  enemy: "border-red-500 bg-red-50",
  hero: "border-blue-500 bg-blue-50",
  neutral: "border-yellow-500 bg-yellow-50"
};

const activeIndicatorClasses: Record<Actor["layoutGroup"], string> = {
  enemy: "bg-red-600",
  hero: "bg-blue-600",
  neutral: "bg-yellow-600"
};

type InitiativeRowProps = {
  actor: Actor;
  active: boolean;
  initiativeValue: number | undefined;
  selected: boolean;
  onClick: (actorId: string, event: MouseEvent<HTMLElement>) => void;
  onDoubleClick: (actorId: string, event: MouseEvent<HTMLElement>) => void;
  onDrag: (pointerClientY: number) => void;
  onDragEnd: (actorId: string) => void;
  onInitiativeChange: (actorId: string, initiative: number | undefined) => void;
  onInvalidInitiative: (actorId: string, input: string) => void;
  onRemove: (actorId: string) => void;
};

/** Renders one selectable, reorderable initiative participant. */
export function InitiativeRow({
  actor,
  active,
  initiativeValue,
  selected,
  onClick,
  onDoubleClick,
  onDrag,
  onDragEnd,
  onInitiativeChange,
  onInvalidInitiative,
  onRemove
}: InitiativeRowProps) {
  const dragControls = useDragControls();
  const [draftValue, setDraftValue] = useState(initiativeValue?.toString() ?? "");
  const editSourceRef = useRef<"chevron" | "manual" | null>(null);

  useEffect(() => {
    if (editSourceRef.current === null) {
      setDraftValue(initiativeValue?.toString() ?? "");
    }
  }, [initiativeValue]);

  function parseDraft(): number | undefined | null {
    const trimmedValue = draftValue.trim();
    if (trimmedValue === "") return undefined;
    const value = Number(trimmedValue);
    return Number.isInteger(value) &&
      value >= INITIATIVE_MIN &&
      value <= INITIATIVE_MAX
      ? value
      : null;
  }

  function finalizeInitiativeEdit() {
    if (editSourceRef.current === null) return;
    editSourceRef.current = null;
    const value = parseDraft();
    if (value === null) {
      onInvalidInitiative(actor.id, draftValue);
      setDraftValue(initiativeValue?.toString() ?? "");
      return;
    }
    onInitiativeChange(actor.id, value);
  }

  function adjustInitiative(delta: -1 | 1) {
    const parsedDraft = parseDraft();
    const baseValue =
      parsedDraft === undefined ? 0 : parsedDraft ?? initiativeValue ?? 0;
    const nextValue = baseValue + delta;
    if (nextValue < INITIATIVE_MIN || nextValue > INITIATIVE_MAX) return;
    editSourceRef.current = "chevron";
    setDraftValue(nextValue.toString());
  }

  function handleEditorBlur(event: FocusEvent<HTMLSpanElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    finalizeInitiativeEdit();
  }

  const parsedDraft = parseDraft();

  const chevronVisibilityClasses = initiativeValue === undefined
    ? "group-hover/row:pointer-events-auto group-hover/row:opacity-100"
    : "group-hover/initiative:pointer-events-auto group-hover/initiative:opacity-100";

  return (
    <Reorder.Item
      aria-current={active ? "step" : undefined}
      className={`group/row flex items-center gap-2 rounded-xl border px-2 py-2 text-sm
        cursor-pointer ${
        active ? activeFactionClasses[actor.layoutGroup] : "border-canvas-line bg-white"
      }`}
      dragControls={dragControls}
      dragListener={false}
      data-initiative-actor-id={actor.id}
      onClick={(event) => onClick(actor.id, event)}
      onDoubleClick={(event) => onDoubleClick(actor.id, event)}
      onDrag={(event) => {
        if ("clientY" in event) onDrag(event.clientY);
      }}
      onDragEnd={() => onDragEnd(actor.id)}
      onMouseLeave={() => {
        if (editSourceRef.current === "chevron") finalizeInitiativeEdit();
      }}
      onMouseDown={(event) => {
        if (
          event.shiftKey &&
          !(event.target instanceof HTMLInputElement) &&
          !(event.target instanceof HTMLButtonElement)
        ) {
          event.preventDefault();
        }
      }}
      value={actor.id}
    >
      <button
        aria-label={`Reorder ${actor.name}`}
        className="cursor-grab touch-none text-canvas-muted active:cursor-grabbing"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => dragControls.start(event)}
        type="button"
      >
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </button>
      <span className={`min-w-0 flex-1 truncate ${selected ? "font-bold" : "font-medium"}`}>{actor.name}</span>
      {active ? (
        <motion.span
          aria-label="Current actor"
          className={`h-2.5 w-2.5 rounded-full ${activeIndicatorClasses[actor.layoutGroup]}`}
          layoutId="initiative-current-actor"
        />
      ) : null}
      <span
        className="group/initiative flex items-center gap-0"
        onBlur={handleEditorBlur}
      >
        <button
          aria-label={`Decrease ${actor.name} initiative`}
          className={`pointer-events-none opacity-0 text-canvas-muted hover:text-canvas-ink disabled:cursor-not-allowed disabled:opacity-40 ${chevronVisibilityClasses}`}
          disabled={parsedDraft !== null && parsedDraft !== undefined && parsedDraft <= INITIATIVE_MIN}
          onClick={(event) => {
            event.stopPropagation();
            adjustInitiative(-1);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <input
          aria-label={`${actor.name} initiative`}
          className="w-9 border-0 bg-transparent px-0 py-1 text-center outline-none focus:ring-1 focus:ring-canvas-line"
          onChange={(event) => {
            editSourceRef.current = "manual";
            setDraftValue(event.currentTarget.value);
          }}
          inputMode="numeric"
          onBlur={() => {
            if (editSourceRef.current === "manual") finalizeInitiativeEdit();
          }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              finalizeInitiativeEdit();
              event.currentTarget.blur();
            }
          }}
          type="text"
          value={draftValue}
        />
        <button
          aria-label={`Increase ${actor.name} initiative`}
          className={`pointer-events-none opacity-0 text-canvas-muted hover:text-canvas-ink disabled:cursor-not-allowed disabled:opacity-40 ${chevronVisibilityClasses}`}
          disabled={parsedDraft !== null && parsedDraft !== undefined && parsedDraft >= INITIATIVE_MAX}
          onClick={(event) => {
            event.stopPropagation();
            adjustInitiative(1);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </span>
      <button
        aria-label={`Remove ${actor.name} from initiative`}
        className="text-canvas-muted hover:text-red-700"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(actor.id);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        type="button"
      >
        <Skull aria-hidden="true" className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}
