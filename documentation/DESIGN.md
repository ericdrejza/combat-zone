# DESIGN DOCUMENT — Zone-Based TTRPG Encounter Tool

> This document is the single source of truth for product and domain
> decisions (entities, rules, interaction model, MVP scope). Technical
> implementation decisions (stack, folder structure, Redux history, coding
> process) live in `../AGENT.md`. Per-feature testable acceptance criteria live
> in `ACCEPTANCE.md`. Domain facts should not be duplicated across these
> files — if a rule changes here, `../AGENT.md` and `ACCEPTANCE.md` reference
> it rather than restate it.

## 1. Product Vision

A real-time encounter management tool for tabletop RPG Game Masters that enables zone-based tactical abstraction of combat while preserving narrative flexibility.

The system replaces grid-based combat with:

- Zones (polygonal spatial regions)
- Engagement groups (melee clusters)
- Flexible movement edges (graph relationships)
- Actor-based participation (creatures, objects, objectives)

The goal is to reduce GM cognitive load while maintaining clarity for players.

## 2. Core Principles

### 2.1 GM Authority First

- The GM can always override system constraints.
- Validation is advisory unless Strict mode is enabled.

### 2.2 Everything is Direct Manipulation

- No hidden state.
- No multi-step modals for core actions.
- Drag, drop, and context actions are primary.

### 2.3 Spatial Abstraction over Simulation

- Zones represent narrative spaces, not measured distances.
- Movement is relationship-based, not metric-based.

### 2.4 Tool-Driven Interaction

- Toolbar determines interaction mode.
- No global "Setup vs Combat" modes.

### 2.5 Everything is an Entity

All canvas elements are entities:

- Zones
- Actors
- Engagements
- Edges
- Annotations

## 3. System Overview

### 3.1 Workspace Structure

Workspace
├── Asset Library
│ ├── Actor Templates
│ ├── Backgrounds
│ └── Tokens
├── Encounter Templates
└── Active Encounters

## 4. Core Domain Model

### 4.1 Encounter

Root runtime container.

- zones[]
- edges[]
- actors[]
- engagements[]
- annotations[]
- initiativeTracker
- validationState

### 4.2 Zone

Polygonal spatial container.
Properties:

- id
- name
- polygon
- layoutStrategy
- layoutOrientation
- tags

Zone contents are derived from actor `currentZoneId` values and engagement
`parentZoneId` values. Points of interest are Actors with the appropriate
actor type, not a separate stored Zone collection.

Layout strategies:

- FLEX (default)
  - Actors are rendered evenly spread out as symmetrically as possible around the zone
  - Actor placement is dynamic and handled by CSS layout inside the zone
- SEQUENTIAL
  - Actors are rendered one after the other in specific order around the zone
  - Actor order is stable based on collection `allIds`
- SPLIT_SEQUENTIAL
  - Zone is split into two areas for Actors, one for heroes and one for enemies
  - `LEFT_RIGHT` orientation renders heroes left and enemies right
  - `TOP_BOTTOM` orientation renders heroes top and enemies bottom
  - Neutral actors render along the axis splitting heroes and enemies
  - Actors are rendered one after the other in specific order in their specific area within the zone
  - Actor order within each area is stable based on collection `allIds`

**Deletion rule:** deleting a Zone does not delete or block deletion of its
contents. Actors inside it become **zoneless**. Edges connected to it are
**auto-deleted**. This cascade must occur as a single reversible operation
(one undo restores the zone, its actors' prior zone assignment, and the
deleted edges together).

### 4.3 Actor

Unified entity for:

- creatures
- objects
- objectives
- points of interest

Properties:

- id
- name
- actorType
- layoutGroup (hero / enemy / neutral)
- image
- stats (optional system-specific blob)
- currentZoneId | zoneless
- initiative
- statusEffects[]
- metadata

Engagement membership is owned by Engagement `participants[]`; Actors do not
store a duplicate engagement reference.

Actors may be:

- combatants
- interactable objects
- narrative objectives

### 4.4 Engagement

Melee interaction group.

Properties:

- id
- participants[]
- parentZoneId
- layoutStrategy
- layoutOrientation
  - see Zone layout strategies

Rules:

- Transitive membership
- Participants are not pair-linked; they belong to a group
- Actors can move between engagements via drag/drop
- **Auto-dissolution:** an Engagement automatically dissolves (is deleted)
  the moment its participant count drops below 2. An Engagement with 0 or 1
  participants must never persist as a visible entity — this happens
  automatically as part of whatever action caused the drop (participant
  leaving, actor deleted, split, etc.), not as a separate manual step.

### 4.5 Edge

Directional relationship between zones.

Properties:

- fromZoneId
- toZoneId
- directionality (one-way / two-way)
- movementRule:
  - free
  - blocked
  - skillCheck
  - difficult
- visibilityRule:
  - clear
  - obscured
  - blocked
  - oneWay
- interactionTags[] (free-form)
- notes

Edges are graph-first, geometry-independent.

### 4.6 Annotation

Non-game objects:

- arrows
- text
- markers
- measurements
- GM notes

## 5. Interaction Model

### 5.1 Toolbar System

Tools define interaction behavior:

- Select
- Zone Tool
- Edge Tool
- Actor Tool
- Engagement Tool
- Annotation Tool
- Delete Tool
- Pan Tool

Each tool defines:

- selectable entities
- drag behavior
- click behavior
- keyboard shortcuts
- tooltip description (mandatory UI element)

### 5.2 Selection Rules

- Multi-select allowed per active tool type
- No cross-type selection (zones vs actors)
- Shift-click → toggle selection
- Ctrl-click → contextual action (e.g. disengage)
- Box select supported
- Ctrl+Shift → additive box select
- Number hotkeys focus actor layout groups:
  - `1` selects all hero actors in the current selection scope.
  - `2` selects all enemy actors in the current selection scope.
  - `3` selects all neutral actors in the current selection scope.
- `Tab` selects the next actor within the currently focused layout group.
  Repeated `Tab` cycles forward through that filtered group using collection
  `allIds` order.

### 5.3 Drag & Drop Behaviors

| Action                  | Result            |
| ----------------------- | ----------------- |
| Actor → Zone            | Move actor        |
| Actor → Actor           | Create engagement |
| Actor → Engagement      | Join engagement   |
| Actor → empty zone      | Leave engagement  |
| Engagement → Engagement | Merge engagements |
| Actor → Zoneless        | Remove from zone  |

### 5.4 Engagement Interaction

- Engagement = group of participants
- Transitive by definition
- Supports merge/split via drag interactions
- Objects (Actors) can participate (not just combatants)

### 5.5 Edge Interaction Toggle

Validation modes:

- OFF (freeform)
- ADVISORY (warnings only)
- ASSISTED (soft blocking + prompt)
- STRICT (hard validation blocks invalid moves)

## 6. Layout System

### 6.1 Zone Layout Strategies

- FLEX (default)
  - Center-weighted distribution
  - Dynamic spacing
- SEQUENTIAL
  - CSS-ordered placement using deterministic collection order
- SPLIT_SEQUENTIAL
  - Three logical partitions:
    - Heroes
    - Enemies
    - Neutral actors
  - Split orientation is toggleable between `LEFT_RIGHT` and `TOP_BOTTOM`
- Each partition uses sequential placement internally

### 6.2 Engagement Layout Strategies

Same system as zones:

- FLEX
- SEQUENTIAL
- Layout orientation is toggleable between `LEFT_RIGHT` and `TOP_BOTTOM`
- Future strategies: radial / stack / manual

## 7. UI Architecture

### 7.1 Canvas Layout

[Toolbar]
[Left Panel] [Canvas] [Right Panel]
[Bottom Status / Initiative / Validation]

Panels:

- dock left/right only
- collapsible
- stackable vertically
- multiple tabs for panel groups

### 7.2 Panels

- Library Panel
- Initiative Panel
- Properties Panel
- Validation Panel

Panels update based on selection context.

### 7.3 Properties Panel

Context-sensitive editor:

- Actor properties
- Zone properties
- Edge properties
- Engagement properties

## 8. Themes

- Light
- Dark
- System default
- Extensible theme system (future)

## 9. Selection System

- Tool-dependent selection scope
- No cross-type selection
- Multi-select supported
- Familiar modifier keys (Shift, Ctrl, Box select)

## 10. Undo / Redo System

Redux-managed history architecture:

- Every committed state-changing interaction is represented by a serializable
  action record.
- Redux stores encounter history as past, present, and future state snapshots.
- Undo/redo restores exact EncounterState snapshots rather than re-deriving
  prior state.
- Action records are retained as metadata for auditing, validation messages,
  persistence triggers, and future tooling.

## 11. Persistence

### 11.1 Storage

- Local browser storage (autosave)
- Manual save/load

### 11.2 Export/Import

- JSON-based format
- Full workspace export
- Encounter-only export
- Every exported file includes a `schemaVersion` field from MVP onward, so
  future format changes can be detected and migrated rather than silently
  breaking older save files.

### 11.3 Future

Cloud sync (optional monetization)

### 12. Validation Pipeline

Pipeline-based architecture:

Action
→ Validators[]
→ Result
→ Redux state commit or warning

Validators:

- MovementValidator
- EdgeValidator
- EngagementValidator
- ZoneIntegrityValidator

## 13. Rendering System

Render order:

1. Background
2. Zones
3. Edges
4. Actors (free-floating)
5. Engagement overlays
6. Annotations
7. UI overlays

## 14. Actor Placement System

Zones & engagements share layout engines.

Placement strategies:

- FLEX
- SEQUENTIAL
- SPLIT_SEQUENTIAL

Actor and engagement positions inside zones are not persisted in
EncounterState and are not calculated as coordinates. Layout strategies derive
CSS layout descriptors from the normalized entity collections, collection
`allIds` ordering, each entity's layout strategy, and each entity's layout
orientation. Zone geometry itself remains coordinate-based because zones are
canvas objects.

Rule:

- Actors dropped within zone outside engagement return to original position if invalid drop

## 15. MVP Scope

#### Must have

- Zones (polygon draw/edit)
- Actors (drag/drop)
- Engagement groups
- Edges (basic graph)
- Initiative tracker
- Toolbar interaction system
- Undo/redo
- Local persistence

#### Nice to have (post-MVP)

- Advanced validation modes
- Layout strategy expansion
- Cloud sync
- Command palette
- Plugins

## 16. Future Extensions

- Multi-layer encounters
- Verticality (multi-level zones)
- Animated transitions
- AI-assisted GM suggestions
- Rule system plugins per RPG
