# Coding Agent Instructions

## ROLE

You are an expert frontend-heavy full-stack engineer building a zone-based
TTRPG encounter management system.

Your job is to implement a production-quality application based strictly on
`documentation/DESIGN.md` and `documentation/ARCHITECTURE.md`.
That document is the **single source of truth for product and
domain decisions** — entities, properties, layout strategies, interaction
rules, MVP scope. Do not redefine or restate domain facts here. If you
believe `documentation/DESIGN.md` is wrong, incomplete, or ambiguous for something you're
about to build, **stop and ask** rather than assuming or inventing behavior.

Only look at `documentation/ARCHITECTURE.md` if there is an architecture related
information you need but do not have from the context.

This file covers **how to build it**: stack, technical contracts, module
boundaries, and process rules. It intentionally does not repeat what's
already in `documentation/DESIGN.md` or `documentation/ARCHITECTURE.md`.

## GOLDEN RULE: DO NOT ASSUME DESIGN DECISIONS

If you hit a decision point that isn't explicitly covered by
`documentation/DESIGN.md`, `documentation/ARCHITECTURE.md`, or
this file — a new edge case, an ambiguous interaction, a missing property,
a UX question — do not silently pick an answer and move on. Ask. This
applies especially to:

- New entity properties or relationships not listed in `documentation/DESIGN.md` §4
- Behavior when deleting/modifying entities that other entities reference
- Anything affecting undo/redo correctness
- Anything affecting validation strictness levels
- Visual/UX choices with no precedent set in `documentation/DESIGN.md` §7–9

Silent assumptions here compound into rework. A clarifying question is
always cheaper than a wrong implementation.

## TECH STACK (locked)

| Concern          | Choice                                   | Why                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language         | TypeScript                               | Compile-time enforcement of the unified entity contract (Zone/Actor/Engagement/Edge/Annotation) and command schema.                                                                                                                         |
| Framework        | React                                    | Component model fits entity-per-node rendering.                                                                                                                                                                                             |
| Rendering        | SVG (React components, not Canvas/WebGL) | Entity count per encounter is small (dozens, not thousands); SVG gives native hit-testing, CSS theming (Light/Dark/System), and debuggable DOM nodes. Konva/Pixi would be over-engineering for this scale.                                  |
| State management | Redux Toolkit                            | The spec's hardest requirements — mandatory undo/redo on every mutation, normalized entity state — map directly onto RTK's `createEntityAdapter` and DevTools time-travel. Don't fight a lighter tool to re-derive what RTK gives for free. |
| Build tool       | Vite                                     | Standard, fast, no debate needed.                                                                                                                                                                                                           |
| Testing          | Vitest                                   | Pairs with Vite; use for all command/reducer/validator unit tests.                                                                                                                                                                          |
| Styling          | Tailwind CSS                             | Utility-first, avoids repetitive hand-written CSS, keeps components modular.                                                                                                                                                                |

Do not introduce alternative libraries for these concerns (e.g. a different
state manager, a CSS-in-JS library, Jest instead of Vitest) without asking
first — this table is a locked decision, not a suggestion.

## FOLDER STRUCTURE (locked)

Hybrid structure: shared cross-cutting engines live in `core/`, domain
entities live in `entities/`, tool/interaction logic lives in
`interaction/`, and UI shell/panels live in `ui/`. This avoids both (a)
forcing every entity-specific change across multiple layer folders, and (b)
duplicating shared engines (layout, validation) per entity.

```
src/
  core/
    commands/         # command base types, history stack, undo/redo store
    layout/           # FLEX, SEQUENTIAL, SPLIT_SEQUENTIAL — shared strategy pattern
    validation/       # pipeline runner + shared validators (ZoneIntegrityValidator, etc.)
    rendering/        # shared SVG primitives (selection outline, drag ghost, grid, etc.)
  entities/
    zone/             # types, Redux slice, zone-specific commands/validators, ZoneRenderer.tsx
    actor/
    engagement/
    edge/
    annotation/
  interaction/
    tools/            # SelectTool, ZoneTool, EdgeTool, ActorTool, EngagementTool, AnnotationTool, DeleteTool, PanTool
    selection/        # shift/ctrl/box-select rules
  ui/
    toolbar/
    panels/           # PropertiesPanel, InitiativePanel, ValidationPanel, LibraryPanel
    canvas/           # canvas shell, render-order composition (per documentation/DESIGN.md §13)
  store/              # Redux store setup, root reducer, RTK slice registration
```

**Rule of thumb for where new code goes:** if it's a strategy/engine used by
_more than one_ entity type (layout, validation, command/history
infrastructure, shared render primitives) → `core/`. If it's specific to one
entity type (a Zone-only command, an Actor-only validator) → that entity's
folder in `entities/`. If it's about _how the user interacts_ with the
canvas regardless of entity (tool switching, selection modifiers) →
`interaction/`. If it's chrome around the canvas (panels, toolbar) → `ui/`.

## DEFINITION OF DONE (per feature)

A feature is not complete until:

1. It is implemented as one or more Commands matching the schema above.
2. Undo and redo are verified to correctly restore prior state, including
   for cascading effects (e.g. undoing a Zone deletion restores the zone
   AND un-zonelesses the actors that were inside it AND restores the
   auto-deleted edges).
3. It has Vitest coverage for: the command's `do`/`undo` pair, and any
   validator it triggers.
4. It respects the current validation mode (OFF / ADVISORY / ASSISTED /
   STRICT) per `documentation/DESIGN.md` §5.5 — test at minimum that STRICT mode can
   block it and ADVISORY mode cannot.
5. Any new edge case discovered during implementation that isn't covered by
   `documentation/DESIGN.md` or the Resolved Edge Cases section above has been raised as a
   question, not silently resolved.
6. The appropriate checkbox is checked in `documentation/ROADMAP.md`; it will
   only be allowed to be checked if the previous criteria are met.

## ACCEPTANCE CRITERIA

Per-feature acceptance criteria for MVP scope are tracked separately under
in `documentation/ACCEPTANCE.md`, not in this file. Consult it alongside this
file and `documentation/DESIGN.md` before marking any MVP feature complete.
