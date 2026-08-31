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

- name
- zones[]
- edges[]
- actors[]
- engagements[]
- annotations[]
- initiativeTracker
- validationState
- canvasSize
- backgroundImage (optional, including intrinsic image dimensions)

The encounter canvas defaults to 960×640 logical units. Background sizing
commands change the persisted canvas bounds and uniformly scale every Zone
polygon from the top-left origin. Actor, Engagement, and Edge geometry remains
derived from the scaled Zones. Background images always preserve their
intrinsic aspect ratio and fill the resulting canvas without cropping.

Adding or replacing a background sizes the canvas so the full image is as
large as possible within the visible workspace. Deleting a background keeps
the current canvas bounds. The Background Tool also provides one-time fit,
fit-width, fit-height, 10% shrink, and 10% expand commands. Shrinking clamps to
the nearest larger scale that retains valid Zone and derived actor layouts.
These sizing controls remain available without an image, using the current
canvas aspect ratio. Fit commands target the logical area visible at the
current viewport zoom. Every background or canvas-size mutation is one
reversible history action.

The active Encounter name is visible before the toolbar tools on the desktop
layout. Clicking the name replaces it with an inline input in the same toolbar
position; the input is layered above the other toolbar elements while editing
and selects the complete current name. Below 1024px, the name position becomes
an icon-only pencil button; a touch hold shows the Encounter name in a tooltip,
and clicking the button opens the rename dialog. Renaming trims surrounding
whitespace, requires a non-empty result, and commits as one reversible history
action.

### 4.2 Zone

Polygonal spatial container.
Properties:

- id
- name
- polygon
- layoutStrategy
- layoutOrientation
- showSectionDividers
- autoResize
- tags

Zone contents are derived from actor `currentZoneId` values and engagement
`parentZoneId` values. Points of interest are Actors with the appropriate
actor type, not a separate stored Zone collection.

Layout strategies:

All actor layout strategies use deterministic polygon-footprint packing for
rectangle, circle, hexagon, and user-drawn zones. In dense packing, actor
footprints retain at least 4px of clearance across FLEX, SEQUENTIAL,
SPLIT_FLEX, and SPLIT_SEQUENTIAL; layouts use larger preferred clearance when
space permits.

- FLEX (default)
  - Actors are rendered evenly spread out as symmetrically as possible around the zone
  - Spare room is distributed around actors in two dimensions, keeping actors
    away from zone borders when the available space does not require compact
    packing
- SEQUENTIAL
  - Actors are rendered one after the other in specific order around the zone
  - Actor order is stable based on collection `allIds`; an actor entering a
    different zone is appended to that collection order
- SPLIT_FLEX
  - Zone is split into isolated mini-zone sections for heroes, neutral actors,
    and enemies
  - `LEFT_RIGHT` orientation renders heroes left and enemies right
  - `TOP_BOTTOM` orientation renders heroes top and enemies bottom
  - Neutral actors render along the axis splitting heroes and enemies
  - Each section is sized from only its own actors, first reserving the space
    required to fit them and then receiving a share of remaining space
    proportional to their rendered footprint area
  - Section boundaries are malleable during zone resizing and layout. Actual
    actor fit takes priority: boundaries borrow unused room from adjacent
    sections before remaining room is distributed by actor footprint area
  - Actors use an independent FLEX layout scoped to their section, with
    space-around distribution that does not use actors in other sections when
    deriving its shape or spacing
- SPLIT_SEQUENTIAL
  - Uses the same isolated, area-weighted mini-zone sections as SPLIT_FLEX
  - `LEFT_RIGHT` orientation renders heroes left and enemies right
  - `TOP_BOTTOM` orientation renders heroes top and enemies bottom
  - Neutral actors render along the axis splitting heroes and enemies
  - Actors are centered in aligned lines within their section; a new line is
    created when the current line is full
  - Actor order within each area is stable based on collection `allIds`; an
    actor entering a different zone is appended to that collection order
- `showSectionDividers` is exposed beside the Orientation property only for
  split layouts. When enabled, each active section boundary renders inside the
  zone as a dashed line in the zone border color at 70% opacity.

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
- size
- stats (optional system-specific blob)
- currentZoneId | zoneless
- statusEffects[]
- metadata

Engagement membership is owned by Engagement `participants[]`; Actors do not
store a duplicate engagement reference.

Initiative membership and values are owned by ordered Initiative Tracker
entries. Each entry is the composite relationship between the tracker, an
Actor ID, and that participant's optional initiative value. Removing an entry
discards its value; adding that Actor again creates a blank entry.

When `autoResize` is enabled, adding an actor to a FLEX zone automatically
enlarges the zone to the smallest size that fits all of its actors. Expansion
moves every available vertex away from the zone origin. If a vertex would
overlap another zone, it stops at the nearest non-overlapping position while
other vertices continue expanding. The original aspect ratio is preserved when
all vertices can expand; rectangles remain rectangles when only some sides can
expand. When it is disabled, the normal geometric fit validation rejects an
actor addition that cannot fit.

Zone polygons may not overlap. This is a hard geometric validation invariant
for zone creation, reshaping, and automatic resizing.

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
- Engagement layout strategies are `FLEX` and `SEQUENTIAL`; their orientation
  is `LEFT_RIGHT` or `TOP_BOTTOM`.
- **Auto-dissolution:** an Engagement automatically dissolves (is deleted)
  the moment its participant count drops below 2. An Engagement with 0 or 1
  participants must never persist as a visible entity — this happens
  automatically as part of whatever action caused the drop (participant
  leaving, actor deleted, split, etc.), not as a separate manual step.
- An Engagement renders as a 24px-diameter circular token using
  `src/assets/images/crossed-swords.svg`. Its fill and border use its parent
  Zone's border color; the swords use the existing luminance-derived readable
  black-or-white text color for that fill.
- Participant, token, connector, and cluster positions are derived render
  targets, not persisted EncounterState facts.

### 4.5 Edge

Directional relationship between zones.

Properties:

- fromZoneId
- toZoneId
- directionality (bilateral / unilateral)
- movementRules[] (empty means unrestricted):
  - blocked
  - skillCheck
  - difficult
- visibilityRule:
  - visible
  - obscured
  - hidden
- shape:
  - straight
  - rightAngled
  - curved
  - sigmoid
- interactionTags[] (free-form)
- notes

Edges are graph-first and geometry-independent. Geometry, boundary anchors,
lane offsets, and paths are derived render state and are never persisted on an
Edge. A zone pair supports at most one bilateral Edge and one unilateral Edge
in each direction. When all three exist, the bilateral route renders between
the two unilateral routes.

The Edge Tool creates relationships by dragging from the source Zone to the
target Zone. Its sticky preset defaults to bilateral, unrestricted movement,
visible, and straight. Dragging into an occupied pair slot replaces that Edge;
dragging an identical preset into the slot selects the existing Edge without a
history entry. Endpoints and directionality are immutable after creation.
Shape is an icon radio group in both the toolbar and Edge Properties: Lucide
MoveRight for straight, CornerDownRight for right-angled, Spline for curved,
and Activity for sigmoid.

Rendered routes attach to the closest available derived boundary anchors and
prefer the shortest collision-free path. Multiple Edges in a Zone pair use
distinct boundary anchors as well as distinct lanes. They keep 12px from
non-participating Zones and same-pair lanes keep 12px between centerlines.
Target-snapped creation previews participate in this lane layout, temporarily
spacing established pair Edges so the preview remains distinguishable. A
preview replacing an occupied pair slot retains that slot's lane.
Clearance may reduce to zero in tight passages, but routes never intentionally
cross a Zone. Rule badges sit around the traveled-path midpoint, away from Zone
boundaries. Each rendered rule icon has a tooltip of at most two words. Visible
is the assumed visibility and has no path icon; obscured uses the Lucide
dashed-eye icon, hidden uses eye-off, and difficult movement uses
chevrons-down. Interaction tags are entered individually with Enter and render
as removable pills in Edge Properties. Edges with tags show a tag icon, while
Edges with notes show an info icon last in the badge. Hovering these icons
shows the tag pills or note contents; canvas tag pills use the sampled canvas
contrast color and are not removable from the canvas. Routes update while Zones move. The free drag preview
tracks the pointer without path interpolation; snapping to a target Zone keeps
the established transition. Right-angled endpoint arrows follow their local
path segment, quantized to its dominant axis: a segment moving farther right
than vertically points right, with equivalent behavior in the other three
cardinal directions. When facing Zone sides have horizontal or vertical
overlap, the route uses that shortest orthogonal span. A right-angled route
stays straight on a clear orthogonal span, but introduces 90-degree turns when
another Zone blocks it. Right-angle routing minimizes its number of turns
before comparing route length; without obstacles it has at most one turn.
Direct curved routes scale their bend by distance and choose concavity from
the target's relative position so their initial tangent progresses toward the
target; routed obstacle waypoints guide curves around intervening Zones.
When an Edge is selected, the canvas status badge summarizes its source,
target, movement and visibility selections, tags, and notes, without shape.
Unrelated Edges may cross, while coincident
segments are discouraged. Existing unroutable Edges retain their last valid
route with a warning; a newly unroutable Edge shows endpoint warnings without
a path. These warnings are non-blocking rendering diagnostics, not graph
validity. Valid Edge paths, arrowheads, and transient creation previews use
the canvas background luminance to choose readable dark ink or white. Red
route diagnostics remain red regardless of the canvas luminance.

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

- Background Tool
- Zone Tool
- Edge Tool
- Annotation Tool
- Actor Tool
- Select
- Engage action
- Disengage action

On desktop, the non-toggle Engage action appears immediately to the right of
Select. It groups the currently selected actors independently per zone: a zone
with fewer than two selected actors is a no-op; otherwise those actors are
removed from their old Engagements, unselected old members remain, and the
selected actors become one Engagement. Any resulting group with fewer than
two members dissolves. The complete operation is one history-tracked action.

On desktop, the non-toggle icon-only Disengage action appears beside Engage
and uses the Lucide `Unlink2` icon. It is enabled when any selected actor
belongs to an Engagement and removes only the selected engaged actors; any
undersized group auto-dissolves in the same history-tracked action.

On mobile, Engage and Disengage are removed from the primary toolbar. When the
Actor or Select tool is active, the bottom-left canvas action row shows Engage
only when at least two selected actors share a Zone, and shows Disengage when
at least one selected actor belongs to an Engagement. If both are shown,
Disengage is to the right of Engage. Delete remains the leftmost action when
it shares that row.

Panning is handled by right-click drag rather than a dedicated toolbar tool.

Each tool defines:

- selectable entities
- drag behavior
- click behavior
- keyboard shortcuts
- tooltip description (mandatory UI element)

Every primary tool has an established icon. At viewport widths below 1024px,
the primary toolbar is an icon-only, horizontally scrollable row with touch
targets of at least 44 CSS pixels. Holding a tooltip-bearing element with a
touch pointer for 500ms shows its tooltip without activating the control;
mouse input continues to use hover and keyboard focus exposes the same help.
The selected tool's
subtools render in a horizontally scrollable bar below the primary row. The
current zoom percentage remains persistent in the compact toolbar; the
Encounter name is available from the far-left rename button's touch-hold
tooltip. The rename button is the first icon in the same horizontally
scrollable compact toolbar row as the other tools.

On mobile, selecting one or more Zones, Edges, or Actors with its matching
entity tool shows an icon-only Delete control at the bottom-left of the canvas.
The control deletes the complete current same-type selection through the same
history-tracked workflow as the keyboard Delete command.

Zoom is a utility rather than an entity-editing mode. On compact screens it is
a primary toolbar icon whose controls occupy the subtool bar without changing
the active editing tool. On larger screens the zoom controls remain at the
right edge and can collapse to or expand from a single icon; they begin
expanded each session.

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
| Actor → Engagement      | Join after intent |
| Actor → empty zone      | Leave engagement  |
| Engagement → Engagement | Merge engagements |
| Actor → Zoneless        | Remove from zone  |

Dragging multiple selected actors moves all dragged actors. Cross-zone drops
are allowed and preserve the established actor/group move semantics.
While a proper subset of an Engagement is dragged, every connector branch
touching a dragged participant retracts with the same 30px behavior as a
single-actor drag, so no settled branch lingers behind. When every participant
of an Engagement is dragged, its token and complete connector network instead
translate by the same transient vector as the actors. This complete-group
preview applies before drop even when the destination is another Zone.
Dragging a Zone translates its derived actor placements, Engagement tokens,
and Engagement connectors by the same transient vector as the Zone polygon.
The move does not repack Zone contents during the drag.

Hovering an unengaged target actor, an existing Engagement participant, or an
Engagement token for 500ms during an Actor drag shows an engagement-intent
symbol. Dropping after that delay creates or joins the intended Engagement;
dropping before it moves the dragged actors to the target zone without joining
or creating the target Engagement. When every member of an Engagement is
dragged to another zone before intent matures, that Engagement and its
membership are preserved and its `parentZoneId` and each participant's
`currentZoneId` change to the destination zone. A partial-group quick drop
retains the established behavior: moved actors leave their old Engagement and
unengaged actors remain unengaged.

Once an actor's 500ms engagement intent over an actor or Engagement target has
matured, or while an Engagement token is over another Engagement token, the
Engage toolbar action uses its active color. The matured actor intent marker is
a circular badge containing the crossed-swords Engagement icon. An Engagement
token targeted by a token merge drag is outlined with the same readable color
as its Zone name. When an engaged actor moves beyond its 30px tether without a
matured engagement target, the Disengage toolbar action uses its active color.
These previews are transient interaction state and do not create history
entries.

### 5.4 Engagement Interaction

- Engagement = group of participants
- Transitive by definition
- Supports merge/split via drag interactions
- Objects (Actors) can participate (not just combatants)
- An Engagement token is draggable in the Actor and Select tools.
- Clicking an Engagement token selects all of its participant actors.
- Token drag previews use MotionValues so pointer movement does not cause
  canvas-wide re-renders. If a token is not dropped onto another token to
  merge, it slides from its released point back to its derived settled position
  without a domain mutation; connector token endpoints follow the preview.
- Dragging an engaged actor keeps its connector visible until it has moved 30px
  from its settled position, then recoils it to the Engagement token center in
  approximately 150ms using Motion. If the actor returns within that same 30px
  tether distance before drop, the actor remains in its Engagement and returns
  to its settled position without a domain mutation. The settled layout, rather
  than this drag transition, owns connector-routing guarantees.

### 5.5 Edge Interaction Toggle

Validation modes:

- OFF (freeform)
- ADVISORY (warnings only)
- ASSISTED (soft blocking + prompt)
- STRICT (hard validation blocks invalid moves)

Geometric fit is a universal invariant across all validation modes: an actor
move or creation, or an engagement change, that would place overlapping actors
or would leave no valid in-zone footprint is rejected in OFF, ADVISORY,
ASSISTED, and STRICT modes. Other validation messages retain the mode behavior
above.

When a FLEX zone is resized below the minimum size needed for its actors, the
attempted polygon is uniformly enlarged to the smallest size that supports
every actor without overlap. Uniform scaling preserves the shape proportions
and the aspect ratio of the attempted resize. If an actor footprint resize
would require this automatic zone enlargement, STRICT rejects the actor
resize, ADVISORY and OFF apply it with a validation note, and ASSISTED asks
for confirmation before applying both changes.

### 5.6 Canvas Viewport Navigation

Viewport navigation is session-only perception state and does not change
encounter coordinates or create history. Zoom ranges from 20% to 400%; zoom-in
and zoom-out use 10-point steps and preserve the viewed canvas center. Zoom to
fit shows the complete canvas within the available viewport. The toolbar shows
the current percentage and provides an explicit reset to 100%. At 100%, equal
logical actor sizes have equal perceived sizes regardless of canvas bounds.
Loading a different encounter initially zooms it to fit.

A canvas-size mutation preserves zoom and keeps the same proportional canvas
point centered by mapping it through the top-left resize transform. When the
rendered canvas no longer overflows an axis, it centers on that axis.

The canvas viewport scrolls on both axes with scrollbar chrome hidden. The mouse wheel scrolls vertically,
Shift + mouse wheel scrolls horizontally, and arrow keys scroll while the
viewport has focus. Right-button drag panning is enabled by default and can be
toggled from the toolbar. A right-click without a pan gesture retains the
active tool's existing context action.

Touch input uses one pointer for the active tool's normal editing gesture and
two pointers for midpoint-preserving pan and pinch zoom. Touch holds anywhere
in the application do not invoke browser or application right-click context
actions; context actions remain available through normal mouse right-click
when testing a compact layout. Touch multi-selection is exposed as a subtool
toggle because modifier keys are not available.
Perception-only touch navigation does not create history.

## 6. Layout System

### 6.1 Zone Layout Strategies

- FLEX (default)
  - Center-weighted distribution
  - Dynamic spacing
- SEQUENTIAL
  - CSS-ordered placement using deterministic collection order
- SPLIT_FLEX
  - Three logical partitions:
    - hero
    - neutral
    - enemy
  - CSS-distributed placement inside each partition
- SPLIT_SEQUENTIAL
  - Three logical partitions:
    - Heroes
    - Enemies
    - Neutral actors
  - Split orientation is toggleable between `LEFT_RIGHT` and `TOP_BOTTOM`
- Each partition uses sequential placement internally

### 6.2 Engagement Layout Strategies

Engagement-internal layouts use:

- FLEX
- SEQUENTIAL
- Layout orientation is toggleable between `LEFT_RIGHT` and `TOP_BOTTOM`
- Future strategies: radial / stack / manual

## 7. UI Architecture

### 7.1 Canvas Layout

[Toolbar]
[Left Panel] [Canvas] [Right Panel]
[Bottom Status / Initiative / Log]

Panels:

- dock left/right at viewport widths of 1024px and above
- collapsible
- stackable vertically
- multiple tabs for panel groups

Below 1024px, the canvas owns the workspace and docked panels are replaced by
a bottom-right launcher and one right-side overlay drawer. The launcher uses
this wrapping panel order: Log, Library, Zoneless, Properties, Status,
Initiative. Library is the initial target. A short tap toggles the targeted panel
drawer. Holding for 500ms opens a persistent upward vertical icon bar; releasing
the launcher leaves the bar open without closing an open panel. Tapping outside
the icon bar closes it. Tapping an icon changes the launcher target; an open
panel replaces its content in place, while a closed panel remains closed until
the next launcher tap. Panels fade in and out without horizontal travel. The
panel leaves the launcher rail visible and closes from the launcher, its header,
backdrop, or Escape.

The compact panel launcher also remains available on coarse-pointer, no-hover
touch devices when a browser's desktop-site mode reports a layout viewport at
or above 1024px.

### 7.2 Panels

- Library
- Initiative
- Properties
- Log (committed actions and blocked validation attempts, categorized for
  filtering)
- Status

Panels update based on selection context.

The Zoneless actors presentation remains the collapsible, resizable
bottom-center overlay on larger screens and becomes a panel in the compact
drawer. Starting a touch drag from a Library actor token or Zoneless closes
the drawer after the movement threshold while the same drag continues over
the revealed canvas. Library and Zoneless actor transfers use the same
pointer-based gesture for mouse, touch, and pen input on every layout. Library
backgrounds apply on tap and are not dragged.
Tapping a Library actor creates it with the active Actor Tool settings when a
target Zone was previously selected. The Actor creation dialog's preview uses
the same pointer-based transfer for mouse, touch, and pen input, closing the
dialog after movement begins and creating the configured Actor where the
pointer is released.

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
4. Engagement layer (connectors and tokens)
5. Actors (free-floating and engagement participants)
6. Annotations
7. UI overlays

The Engagement layer is after Edges and before Actors. Its connectors and
tokens therefore render behind actor tokens. Direct connectors may share only
their own Engagement-token endpoint; a fallback tree may meet at its connected
participant endpoint, but otherwise connectors do not intersect. In a zone
with multiple Engagements, other Engagement tokens and accepted connectors are
routing obstacles. Engagement clusters are separated by token ownership:
every participant center must remain closer to its own Engagement token than
to another Engagement token. One Engagement therefore cannot wrap around or
occupy the interior of another, while elongated chains do not reserve an
unnecessarily large circular area.
The token coordinate accepted by packing is the single derived coordinate
used by rendering, connector routing, drag/drop hit-testing, and Zone-move
cache translation. Those consumers must not independently recompute a settled
token from participant centers.

## 14. Actor Placement System

Zones & engagements share layout engines.

Layout strategies:

- FLEX
  - Tokens are spread evenly around the zone
- SEQUENTIAL
  - Tokens are placed in a predictable order around a zone based on the shape.
  - For non-circles, start with populating the zone just inside the corners (verticies)
  - For circles, start populating inside the circle at the top and work clockwise
- SPLIT (SPLIT is not a layout strategy, but rather a category of layout strategies)
  - SPLIT_FLEX
    - Each faction is an isolated section whose tokens use section-scoped FLEX
      space-around distribution.
  - SPLIT_SEQUENTIAL
    - Tokens are centered in predictable, aligned, wrapping lines within their
      isolated section in a zone.
      - options: left -> right, top -> bottom
  - Engaged actors are excluded from faction sections. Each active Engagement
    dynamically receives one isolated section, ordered by `engagements.allIds`,
    between the hero and neutral sections. Its participants and 24px token fit
    within that section. Unengaged actors remain in their faction sections.

Actor and engagement positions inside zones are not persisted in
EncounterState. Layout strategies derive render targets from the normalized
entity collections, collection `allIds` ordering (which records the latest
zone-entry order for actors), each entity's layout strategy, and each entity's
layout orientation. FLEX derives deterministic polygon-footprint coordinates
using configurable preferred/minimum border spacing and rendered actor shapes
for every zone shape. Zone geometry itself remains coordinate-based because
zones are canvas objects.

Engagement clusters keep participant tokens comfortably close to their
Engagement token without overlap. Participant spacing prefers a 10px gap and
uses 4px as the hard minimum in dense layouts unless two actors are joined by
an actor-to-actor connector. Anchored actors retain at least 10px of visible
edge-to-edge space so the 2px connector remains legible. Settled connectors
avoid actor footprints and other connector lines. Routing uses bounded
best-effort direct paths; when a direct path is unavailable, it falls back to
a same-style actor-to-connected-actor network/tree. Direct routes may share
their own Engagement-token endpoint. A fallback tree may instead meet at a
connected participant endpoint, but otherwise preserves those avoidance rules.
When both routes are valid, a token-to-actor spoke is preferred unless the
shortest actor-to-actor branch is at most half the spoke length. The ratio is
a configurable layout constant. An obstructed route is never selected solely
because of this length preference.
Every participant must have exactly one routed connector either from the
Engagement token or from an already connected actor. A derived layout with an
unreachable participant is invalid and is blocked in every validation mode.
Collision checks use complete rendered shapes rather than center-distance
proxies: circle/circle, axis-aligned rectangle/rectangle, and
circle/rectangle pairs must retain the minimum gap. Tokens are circular
footprints. Connectors avoid complete circle and rectangle areas, and
independent 2px connector strokes retain enough center-line separation that
their painted areas do not overlap; only the already-defined shared token or
participant endpoints are exempt.
Engagement membership has no numeric layout cap: FLEX first tries multiple
concentric participant rings. If radial candidates cannot fit all groups, the
complete Zone is repacked with token-anchored serpentine chain candidates,
from elongated to compact and from the Zone boundary inward. Capacity is
limited only by whether all actor and token footprints fit the Zone with valid
connectors.
Every settled Engagement actor and token retains at least 4px between its
outer footprint and the Zone boundary. Curved and sloped Zone edges use the
shortest center-to-polygon-edge distance for this check rather than sampling
only cardinal footprint points.
In a FLEX Zone with sufficient room, engagement participants first try a
slightly more open 22px or 16px clearance before falling back to the standard
10px preferred and 4px minimum clearances. In split layouts, Engagement
participants first align in a line along the visible section-divider axis:
LEFT_RIGHT splits use a vertical line and TOP_BOTTOM splits use a horizontal
line. If that line cannot fit a larger group, participants wrap into parallel
lines within the same section. Obstructed token spokes use the same
actor-to-actor connector chaining described above.
When an ordinary FLEX Zone contains multiple Engagements, candidate centers
prefer separate Zone-local regions: each later group balances distance from
already accepted Engagement tokens with usable distance from the Zone edge.
This is a placement preference, not reserved space; compact and chain
fallbacks remain available when density requires them. Split layouts continue
to use their isolated sections instead.

Rule:

- Actors dropped within zone outside engagement return to original position if invalid drop
- Engagement changes and actor/zone layout changes are rejected when any
  Engagement participant cannot receive a token-to-actor or actor-to-actor
  connector; this applies in every validation mode.
- After packing, a separate hard validator audits every actor/actor,
  actor/token, and token/token pair. Any intersecting rendered area blocks the
  state change in every validation mode, independently of the candidate
  packer's internal checks.
- Actor movement or creation is rejected when FLEX cannot fit the
  resulting actor footprints without overlap; this rejection applies in every
  validation mode.
- FLEX zone resizing enlarges an undersized target to the smallest uniformly
  scaled polygon that fits its actors.
- Actor footprint resizing follows the validation-mode policy in §5.5 when
  enlarging its zone is required.

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
