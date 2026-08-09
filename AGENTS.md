# Coding Agent Instructions

## ROLE

You are an expert frontend-heavy full-stack engineer specializing in React
building a zone-based TTRPG encounter management system.

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
| Language         | TypeScript                               | Compile-time enforcement of the unified entity contract (Zone/Actor/Engagement/Edge/Annotation) and Redux history schema.                                                                                                                   |
| Package Manager  | npm                                      | This should be a small project                                                                                                                                                                                                              |
| Framework        | React                                    | Component model fits entity-per-node rendering.                                                                                                                                                                                             |
| Rendering        | SVG (React components, not Canvas/WebGL) | Entity count per encounter is small (dozens, not thousands); SVG gives native hit-testing, CSS theming (Light/Dark/System), and debuggable DOM nodes. Konva/Pixi would be over-engineering for this scale.                                  |
| State management | Redux Toolkit                            | The spec's hardest requirements — mandatory undo/redo on every mutation, normalized entity state — map directly onto Redux-managed history, RTK reducers, and DevTools time-travel. Don't fight a lighter tool to re-derive what RTK gives for free. |
| Data format      | NoSQL JSON document model                | Encounter and workspace data are versioned JSON documents with normalized `byId` / `allIds` collections, making local persistence, export/import, and future document storage straightforward without relational schema migrations.          |
| Build tool       | Vite                                     | Standard, fast, no debate needed.                                                                                                                                                                                                           |
| Testing          | Vitest                                   | Pairs with Vite; use for all history/reducer/validator unit tests.                                                                                                                                                                          |
| Styling          | Tailwind CSS                             | Utility-first, avoids repetitive hand-written CSS, keeps components modular.                                                                                                                                                                |

Do not introduce alternative libraries for these concerns (e.g. a different
state manager, a CSS-in-JS library, Jest instead of Vitest) without asking
first — this table is a locked decision, not a suggestion.

## STATE MODELING RULES

- Persist every domain fact in exactly one place. Do not add duplicate
  source-of-truth fields for convenience, reverse lookup, or rendering.
- Model relationships with normalized IDs in the owning entity or root
  collection, then expose resolved objects through selectors/inspectors.
- If a relationship can be derived from an existing authoritative field,
  derive it instead of storing a second copy. Add a selector before adding
  redundant state.
- Only denormalize persisted state for a proven performance or product need,
  and document the synchronization invariant before implementing it.

## ENGINEERING QUALITY RULES

- Keep source files under 300 lines whenever practical. If a file approaches
  that limit, split it by responsibility before adding more behavior.
- Follow Single Responsibility Principle: each module, component, hook,
  reducer, selector, validator, and test file should have one clear reason to
  change.
- Follow DRY without creating premature abstractions. Extract duplicated logic
  once the shared behavior is clear and the abstraction improves readability.
- Follow SOLID and Separation of Concerns. Keep domain state, selectors,
  interaction handlers, rendering components, and styling concerns in focused
  files rather than concentrating unrelated responsibilities in one module.
- Prefer small, composable functions with explicit inputs and outputs over
  hidden coupling or broad shared mutable state.
- Use clear, concise comments for classes, exported functions, hooks, reducers,
  selectors, and complex logic when the intent or invariant is not obvious
  from the code itself.
- Comments on classes, interfaces, functions, etc., should explain why behavior
  exists, important constraints, or non-obvious edge cases. Avoid comments that
  merely restate the code.
- Use path aliases for imports from files that do not share a directory or 
  belong to a subfolder from this file's directory downwards. 

## UI IMPLEMENTATION RULES

- Prefer icon-only controls when an icon communicates the action more clearly
  than text, while keeping accessible names through `aria-label` or equivalent
  semantics.
- Use established icon sets for common controls such as drag handles,
  reorder affordances, chevrons, close buttons, and disclosure controls; do
  not hand-author bespoke SVGs for standard icons.
- Use Motion package for any and all movmement, animations, etc..
  - Refer to documentation only if absolutely necessary `https://motion.dev/docs/react`

## FOLDER STRUCTURE (locked)

Hybrid structure: shared cross-cutting engines live in `core/`, domain
entities live in `entities/`, tool/interaction logic lives in
`interaction/`, and UI shell/panels live in `ui/`. This avoids both (a)
forcing every entity-specific change across multiple layer folders, and (b)
duplicating shared engines (layout, validation) per entity.

```
src/
  library/           # asset library state, UI, and upload helpers
  hooks/             # shared React hooks
  core/
    encounter/       # encounter state shape, creation, and inspectors
    history/          # Redux history types and undo/redo helpers
    layout/           # FLEX, SEQUENTIAL, SPLIT_SEQUENTIAL — shared strategy pattern
    rendering/        # shared SVG primitives and overlay visuals
    validation/       # pipeline runner + shared validators (ZoneIntegrityValidator, etc.)
    state/            # normalized entity collection helpers
  entities/
    actor/           # actor domain types and actor-specific logic
    engagement/      # engagement domain types and engagement-specific logic
    edge/            # edge domain types and edge-specific logic
    annotation/      # annotation domain types and annotation-specific logic
    zone/             # types, Redux slice, zone-specific actions/validators, ZoneRenderer.tsx
  interaction/
    tools/            # SelectTool, ZoneTool, EdgeTool, ActorTool, EngagementTool, AnnotationTool, BackgroundTool, DeleteTool
    selection/        # shift/ctrl/box-select rules
  store/             # Redux store setup and slice registration
  ui/
    canvas/           # canvas shell, render-order composition (per documentation/DESIGN.md §13)
    library/          # library panel and modal UI
    panels/           # PropertiesPanel, InitiativePanel, ValidationPanel, LibraryPanel
      zone_properties/ # zone properties subpanels and controls
      zoneless_actors/ # zoneless actors panel
    toolbar/          # top-level toolbar and tool buttons
      background/     # background tool controls and file handling
      zone/           # zone tool controls and mode switching
tests/               # All tests live here
```

**Rule of thumb for where new code goes:** if it's a strategy/engine used by
_more than one_ entity type (layout, validation, history
infrastructure, shared render primitives) → `core/`. If it's specific to one
entity type (a Zone-only action, an Actor-only validator) → that entity's
folder in `entities/`. If it's about _how the user interacts_ with the
canvas regardless of entity (tool switching, selection modifiers) →
`interaction/`. If it's chrome around the canvas (panels, toolbar) → `ui/`.

Do not read entire directories within node_modules as that is expensive.

Use snake_case when creating multi-word directory names.

### CanvasShell boundary

Keep `src/ui/canvas/CanvasShell.tsx` as a composition/orchestration component. Move
canvas-specific workflows (such as drag/drop mutations), global input listeners,
and SVG layer composition into focused hooks, helpers, or presentational
components so the shell remains small and easy to reason about.

## DEFINITION OF DONE (per feature)

A feature is not complete until:

1. It commits EncounterState changes through Redux history using the schema
   above.
2. Undo and redo are verified to correctly restore prior state, including
   for cascading effects (e.g. undoing a Zone deletion restores the zone
   AND un-zonelesses the actors that were inside it AND restores the
   auto-deleted edges).
3. It has passing Vitest coverage for undo/redo behavior, and any validator it
   triggers. `npm run test:agent`
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

## TESTING
1. When testing using `vitest`, use the `--reporter=agent` flag with the command
to reduce output.
2. If you see a test that is breaking due to a change that you didn't make, ask
me what is the expected behavior and update the test accordingly.
3. Do not test for styling (e.g. css styling on an element)
4. If a bug or issue persists after multiple attempts at fixing it, resort to
realtime agent testing of the application.
