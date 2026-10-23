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

Zone movement offers tactical abstraction through:

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
- Zone movement is relationship-based. Grid and Free movement follow §17.

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
- rulers (normalized locked measurement artifacts; see §18)
- counters (normalized encounter-scoped collection)
- clocks (normalized encounter-scoped collection)
- initiativeTracker (optional movement totals keyed by actor ID; distance and diagonal count for the active accounting period)
- grid (geometry plus lineStyle, distancePerCell, and distanceUnit; see §18)
- validationState
- canvasSize
- backgroundImage (optional, including intrinsic image dimensions)

The encounter canvas defaults to 960×640 logical units. Background sizing
commands change the persisted canvas bounds and uniformly scale every Zone
polygon from the top-left origin. With Zone lock enabled, Actor, Engagement, and Edge geometry remains
derived from the scaled Zones. Grid geometry and unlocked actor positions
do not scale with the background; changing background size may break alignment.
Actor diameters/rectangle widths are 45, 60, 120, and 180 logical units for
Small, Medium, Large, and xLarge under every movement rule combination. Neither grid
configuration nor local warping changes these footprints.
The rendered lattice uses fixed 64-unit spacing (across opposite hex sides);
Isometric cells are diamonds 64 units wide and 64×tan(angle) units high;
the default angle atan(0.5), approximately 26.565°, preserves 2:1 (64×32).
Encounter `grid.cellSize` is a positive, user-facing map-scale value, initially
64, rather than physical spacing. Changing it from A to B uniformly resizes
unpadded coverage and Zone polygons by A/B. Background sizing updates this
value inversely by the actual accepted resize factor. Grid edits use the same
layout clamps, overflow preference, and history boundary as background sizing.
Enlarging the background therefore makes tokens smaller relative to the image,
and shrinking it makes them larger. Background images always preserve their
intrinsic aspect ratio and fill the resulting canvas without cropping, except
when grid edge completion adds unscaled canvas margins. An optional
`backgroundImage.frame` (`x`, `y`, `width`, `height`) then records its logical
placement separately from intrinsic asset dimensions.

Adding or replacing a background sizes the canvas so the full image is as
large as possible within the visible workspace. Deleting a background keeps
the current canvas bounds. The Background Tool also provides one-time fit,
fit-width, fit-height, 10% shrink, and 10% expand commands. Sizing retains the
existing clamp for valid Zone and derived actor layouts.
The Canvas preference “When background resizing puts actors outside the
canvas” defaults to “Move actors to Zoneless”: after edge completion, clear
only saved spatial positions whose full token footprint exceeds canvas bounds,
Preserve resources and Engagement relationships; reevaluate unlocked Zone membership after unplacement. “Limit resizing to keep
actors on canvas” instead clamps to the nearest larger size retaining all saved
spatial placements. This global preference persists, synchronizes across tabs,
resets with local preferences, and falls back to Zoneless for unknown values.
These sizing controls remain available without an image, using the current
unpadded coverage aspect ratio. Percentage commands and active fit indicators
use the logical background frame or original coverage, excluding completed
cell margins. Preserve its top-left anchor when sizing or replacing an image;
a first image uses the current coverage origin. Fit commands target the logical
area visible at the
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
- rotation (signed clockwise degrees; existing zones default to zero)
- shape (rectangle, circle, hexagon, or polygon)
- colorFill
- colorBorder
- colorEngagement
- matchEngagementColorToBorder
- opacity
- showBorder
- showName
- namePosition
- layoutStrategy
- layoutOrientation
- showSectionDividers
- autoResize
- tags
- notes (optional multiline text)
- counters (Zone-owned normalized named integer counters with optional bounds)
- clocks (Zone-owned normalized named progress clocks)

Zone names trim surrounding whitespace and may be empty.
Fill, Border, and Engagement color fields show a swatch and the current hex
color. Their shared spectrum pickers start collapsed, open on a field click,
and remain open after selection until the field is clicked again or Escape is
pressed. They include saturation/brightness, hue, screen eyedropper, ordered
presets, recent custom colors, and hex entry. A completed pointer/keyboard
adjustment, swatch selection, screen pick, or committed hex value remains one
validated, reversible color edit. During dragging, transient color previews update
the Zone on the canvas in real time, including matching Engagement colors and
readable labels. Preview changes do not enter encounter history or persistence.
Release commits one validated edit. Cancelling the gesture, changing the selected
Zone/tab, or closing the editor removes the preview; validation blocks also
restore the saved color.
The Border tab keeps Show border on one line beside its switch. The Engagements
tab places Match border color below the color picker; matching keeps the
Engagement field disabled while showing its color.
Zone color fields use the screen eyedropper inside the shared color picker.
There is no separate background color matcher above the picker. Disabled color
fields also disable their picker and eyedropper.

A pipette sits immediately left of the Zone color paintbrush. Copy
colors from zone lets the user pick a different Zone as the source and applies
the paintable appearance fields to every selected Zone in one undoable action.
It preserves the target selection. Escape, a right click without dragging, or
picking a source exits; right-drag panning does not exit.
Canvas entities other than Zones are hidden while choosing this source.
Zone opacity accepts continuous values without fixed slider increments and previews continuously while its slider is dragged and commits the
final value on release as one reversible history action.

Zone Properties orders its sections as Name, Layout, Color, then Shape. When
Polygon is selected, the Shape section shows a top-right information tooltip
explaining double-click edge insertion and vertex removal with the Zone tool.
Zone Properties provides icon buttons to convert the first selected Zone to
Rectangle (including square), Circle, Hexagon, or Polygon. Generated shapes use
the current polygon's local bounding-box minimum and maximum corners as their resize
controls. Any Polygon can convert without matching the target outline. Converting
to Polygon retains the outline, subject to existing snapping reconciliation.
Conversions follow validated reshaping, including actor-fit adjustments and hard
placement constraints, and commit shape and geometry as one reversible action.
Selecting the existing shape does nothing. Generated shapes must be converted
manually in Properties before double-click vertex editing becomes available.

All Zone shapes support rotation. With the Zone tool active, each selected
Zone shows a thin stem from its local top-center to a RotateCcw handle above
Zone bodies. The handle uses a grab cursor, changing to grabbing during input,
with hover/focus feedback and desktop/touch-hold help. Handle size and stem
length remain constant on screen at different zoom levels. Dragging rotates the
outline freely around its local bounding-box center, frozen at gesture start.
The adjacent label uses the Edge curvature text style and displays rounded signed
clockwise degrees from −180° to 180°. Hide rounded zero while idle; show it during
active rotation. Other tools and unselected Zones show no rotation control or label.

Rotation preserves generated shape identity and editing orientation through
resize and shape conversion. Polygon vertex edits retain that orientation.
`polygon` remains the world outline; `rotation` records the editing/layout frame,
normalized to [−180, 180). Preview is transient; release commits the angle,
outline, and cascades as one validated, undoable action. Escape, cancelled/lost
pointer capture, loss of window focus, and tool/encounter changes cancel an active
gesture. Read-only tabs cannot rotate Zones. Released edits retain existing
pending-reshape ordering and stale-result protection.

With Zone vertex snapping enabled, preview rotation freely and reconcile on
release. Generated shapes retain their shape: rectangles remain rectangular, and
circles/hexagons retain their generated outline. All four oriented bounds-control
corners must coincide with grid vertices. Search nearby grid rectangles, choosing
the bounds closest to the freely rotated controls. Width and height may change
independently, including aspect ratio, and the angle settles to the resulting
bounds orientation. Store and display that snapped angle together with the outline;
reject edits when no valid bounds can be found. Existing hard geometry
and validation-mode constraints still apply. Locked Actor and Engagement centers,
sections, and connectors rotate during preview; artwork remains upright and fixed
in size. Unsnapped locked packing retains the editing frame after release and
reload when upright footprints fit; otherwise use validated packing/fit fallback.
Grid-snapped locked Actors repack to valid anchors on release. Unlocked Actors
remain stationary and Zone membership is reevaluated. Rotation hides the Zoneless
panel under the same rules as reshaping.

The rotation stem, icon, and label follow the same continuous drag geometry as
the Zone body and resize handles, including while vertex snapping is enabled.
On release or cancellation, the stem, icon, and hit target settle with the same
Motion spring as the Zone geometry; direct input and reduced motion remain immediate.

Selected Zone resize handles render above all Zone bodies so overlapping Zones
cannot intercept them. Top/bottom side handles use the vertical resize cursor,
left/right handles use horizontal, and corner handles use the matching diagonal;
the cursor remains visible throughout the drag.

Activating the Zone color paintbrush with multiple Zones selected immediately
copies the first selected Zone's fill, border, Engagement color, color-matching
setting, opacity, and border visibility to the other selected Zones. This is one
validated, reversible action; a blocked batch changes no Zone. The brush stays
active for subsequent canvas painting. While either Zone or Actor paint mode is
active in an editable tab, the canvas and its entity hit areas use a paintbrush
cursor. Leaving paint mode restores normal cursors. Deactivation does not copy properties,
and identical colors do not create history. Property fields still edit only the
first selected Zone; Status still requires one selected Zone. The existing
export-all visual/layout action remains available and excludes shape/geometry
and Zone status fields.

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
  - Zone is split into isolated mini-zone sections for heroes (including
    allies), neutral actors, and enemies
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
- layoutGroup (hero / ally / enemy / neutral; allies share the hero section
  in split layouts)
- image
- size
- shape (circle / rectangle / transparent)
- imageFlippedHorizontal (optional boolean, defaults to false)
- movementLimit (optional nonnegative distance in encounter measurement units; advisory)
- stats (optional system-specific blob)
- currentZoneId | zoneless
- statusEffects[] (stable condition IDs and namespaced weapon/armor markers)
- hitPoints (optional integer current and positive integer maximum)
- resourceBars (optional actor-owned mappings: first = health, counter ID, or none;
  second = counter ID or none; optional healthDisabled remembers a manual
  health-switch opt-out; absent defaults to health in first, none in second)
- counters (actor-owned normalized collection of named integer counters with
  optional minimum/maximum bounds)
- status (ordinal overall health: 0 dead, 1 unconscious / severely injured,
  2 injured, 3 healthy; defaults to healthy)
- metadata

Actor Properties adds a SquareCenterlineDashedHorizontal header toggle with
“Flip actor image” tooltip. It mirrors the selected Actor artwork across its
vertical axis, leaving names, outlines, and placement unchanged. It is disabled
without an image. This Actor property persists through saves, exports, and sync
and supports undo/redo; absent flags in older encounters mean unflipped.

Transparent uses the SquareDashed icon in Actor toolbar and Properties, with
“Transparent” tooltips. Its artwork preserves aspect ratio within the existing
square token-size box, without fill, border, or clipping. Placement and hit
testing use that square box; selection adds only a temporary outline. Actors
without an image retain their centered name fallback. Names wrap within the
token interior when they exceed one line, including breaking long single words.
Fallback names shrink from 10px only when needed to fit, with a 7px minimum.
Preview artwork follows the same
presentation. Schema 25 adds this shape while preserving older geometry.

Engagement membership is owned by Engagement `participants[]`; Actors do not
store a duplicate engagement reference.

Initiative membership and values are owned by ordered Initiative Tracker
entries. Each entry is the composite relationship between the tracker, an
Actor ID, and that participant's optional initiative value. Removing an entry
discards its value; adding that Actor again creates a blank entry.

The initiative row's status control opens a row-width choice strip ordered:
remove from initiative, dead, unconscious / severely injured, injured, healthy.
Each icon has a descriptive tooltip. Interface settings > Panels > Status offers
“Reverse health status icon order”, off by default. It reverses the four health
choices in both Status and Initiative quick select, including their popouts;
Initiative removal stays first. Status keyboard navigation follows the displayed
order. This durable interface preference does not enter encounter history.
Removing an entry preserves Actor status.
Dead participants have muted row text and are skipped when starting combat or
stepping forward/backward. Their names also have a strikethrough by default;
the standard switch in Interface settings > Panels > Initiative toggles this
decoration. This durable interface preference applies in the docked list and
popout and does not change Actor status or encounter history.
Marking the current Actor dead retains its turn
until the user steps. When every participant is dead, Start and step controls
are disabled with a tooltip explaining that an Actor's status must change to
continue; these commands do nothing. Round wrapping counts skipped participants
and backward navigation never precedes round 1.

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
- An Engagement renders as a 24px-diameter circular token using the Lucide
  crossed-swords icon. Its fill, border, and connectors use its parent Zone's
  Engagement color. That color matches the Zone border by default; a Zone can
  disable matching and retain an independent Engagement color. The swords use
  the existing luminance-derived readable black-or-white text color for that
  fill.
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
- color (optional hex color; absent or null uses automatic canvas-luminance color)
- routePreferences (optional flipped orientation and nonnegative curvature factor;
  defaults to unflipped and factor 1)

Edges are graph-first and geometry-independent. Geometry, boundary anchors,
lane offsets, and paths are derived render state and are never persisted on an
Edge. User-selected route orientation and curvature are persisted preferences,
not absolute route coordinates. A zone pair supports at most one bilateral Edge and one unilateral Edge
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
For selected Edges, the Status panel contains Movement, Visibility, Tags, and
Notes. Movement and Visibility support multiple selected Edges; Tags and Notes
require one selected Edge. Edge Properties retains Connection, Shape, Color, and Delete.

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
as removable pills in the Edge Status panel. Edges with tags show a tag icon, while
Edges with notes show an info icon last in the badge. Hovering these icons
shows the tag pills or note contents; canvas tag pills use the sampled canvas
contrast color and are not removable from the canvas. Canvas Settings offers
“Edge routing during Zone drag”: Route estimates (default) or Live optimization.
This applies to movement, resizing, and vertex reshaping. Estimates deform and
validate existing routes in a worker without a full search; where repair is not
possible, temporary segments connect the previous route to the displayed anchors.
Moving an anchor forward along its outgoing Edge shortens that endpoint span
instead of adding a segment back through the moving Zone. Fully consumed leading
spans are removed; curved endpoint controls adjust with the shortened span.
The same behavior applies at either end of an Edge.
Live optimization searches for routes throughout the gesture. Both modes optimize
affected routes after release and animate route changes using Motion.
Translation follows the drag vector; resizing and reshaping preserve the anchor’s
relative position on its border side. Pending geometry updates coalesce to the
latest position rather than queuing every pointer movement.
An interior side anchor stays at its existing coordinates when resizing leaves
that point on the same border side. Whole-Zone translations and moved corners
still update their anchors; no temporary segment is added at an unchanged anchor.
After release, a worker recalculates affected routes against the committed Zone
geometry, including Edges affected by moved obstacles. Unaffected routes are reused.
Connected Edges are prioritized, and completed routes appear individually.
Temporary segments remain until the latest routes arrive. During a gesture, intermediate completed routes can be
shown with endpoint corrections; after release, only the latest geometry is accepted.
If no completed route exists yet, a lightweight provisional connection is shown
while the worker calculates it.
These temporary paths may cross Zones while editing or awaiting a result; final
routes retain normal collision and grid-routing rules. Temporary geometry stays
outside encounter history, and the Zone edit remains one undoable action.
The free drag preview
tracks the pointer without path interpolation; snapping to a target Zone keeps
the established transition. While the pointer remains inside or on the source
Zone, the free preview is hidden and no route search runs. Routing rejects an
endpoint fully enclosed by another Zone without searching for an impossible
path; this is a renderability diagnostic, not a graph-validity restriction.
Snapping to a hovered Zone lasts only while the pointer remains over it; moving
away resumes the free preview without requiring release. Free-pointer route
searches run off the UI thread, coalescing queued pointer positions. A result
for an older position cannot replace the current preview. Snapping, release,
and cancellation discard pending free-preview work.
Right-angled endpoint arrows follow their local
path segment, quantized to its dominant axis: a segment moving farther right
than vertically points right, with equivalent behavior in the other three
cardinal directions. When facing Zone sides have horizontal or vertical
overlap, the route uses that shortest orthogonal span. A right-angled route
stays straight on a clear orthogonal span, but introduces 90-degree turns when
another Zone blocks it. Right-angle routing minimizes its number of turns
before comparing route length; without obstacles it has at most one turn.
When Zone vertex snapping is enabled on a square grid, right-angled Edges
follow actual cell edges, including their boundary attachment points. Routing
minimizes turns, then distance, and prefers separate same-pair routes even if
they are longer; if separation is impossible, routes may share grid segments.
Lane offsets must not move these routes off grid lines. Hex and isometric
grids retain ordinary right-angle routing. Free pointer previews remain free
until they snap to a target Zone.
Direct curved routes scale their bend by distance and choose concavity from
the target's relative position so their initial tangent progresses toward the
target; routed obstacle waypoints guide curves around intervening Zones.
Badges use traveled distance along the rendered SVG curve, including during
geometry changes. With the Edge tool, selected right-angled, curved, and sigmoid
Edges can be dragged toward the opposite equally optimized orientation.
Selected curved and sigmoid Edges show diamond handles at the peaks of their
curve lobes. Dragging a diamond changes the curvature of the whole Edge while
keeping the handle on the curve. Axially aligned sigmoid Edges retain opposing
lobes where the attachment bounds permit them. Curvature is capped so the
entire curve stays inside the horizontal and vertical bounds between its two
attachment corners. Each diamond displays curvature as a percentage of the
available range, from straight (0%) to the corner-bound maximum (100%).
When the attachment sides are parallel, the bounds include those sides' full
spans, so aligned attachment points still allow a visible bend. The percentage
uses that expanded maximum; Zone collision and canvas limits still apply.
During a curvature-handle drag, attachment points and the routed baseline stay
fixed. Control-point displacement supplies the preview without searching routes.
Pointer updates are coalesced to display frames, collision checks preserve the
last valid curve, and release commits one undoable preference change. Body drags
may still search for the opposite route orientation.
If obstacles force the baseline route outside those bounds, automatic obstacle
routing is preserved and curvature handles are unavailable. Existing saved
curvature preferences are retained but do not override that automatic route.
Automatic curved routing checks the rendered Bézier path after smoothing and
lane placement. When a moved Zone blocks that curve, routing uses a collision-free,
tangent-continuous detour. Automatic avoidance may exceed attachment-corner
bounds when needed; manual curvature edits remain bounded. Automatic detours
leave saved preferences intact. During Zone gestures and after release, Motion
animates the displayed path coordinates toward each newly calculated route,
retargeting from the current visible geometry when another update arrives.
Live transitions take 120ms and settled transitions take 200ms. Paths retain
full opacity. Arrowheads follow the animated endpoints, and badges and hit areas
follow the animated path. Line and quadratic segments are represented as exact
cubic equivalents; subdivision reconciles differing segment counts without
changing either endpoint shape. Direct curvature editing remains immediate,
and reduced-motion preferences disable route movement animation. The routing worker validates
completed curves against the committed Zone polygons; an unsafe final path is
hidden. Temporary endpoint connectors are exempt from collision checks until
that completed result arrives. Renderability diagnostics use the final
rendered-curve checks.
Curved and sigmoid routing searches attachment points around both Zone
perimeters, including corners and positions along sides, rather than requiring
the nearest boundary pair. It compares usable direct curves by rendered arc
length, then searches obstacle routes across the available attachment points
when a direct curve cannot be formed. Source and destination Zone interiors
are obstacles too: outgoing and incoming paths may touch their attachment
boundaries but cannot cross their owning Zones. Candidate curves are checked
after lane placement; unsuitable anchors are replaced by anchors on another
side. All attachment points and route choices remain derived render state.
Automatic attachment search prioritizes normal or reduced curvature across the
available border positions before allowing an increased bend at any anchor.
Within that preferred group it compares rendered route lengths. Larger bends
remain a last resort when gentler attachment choices cannot form a route;
saved manual curvature preferences are preserved.
Adjustments stop at the last valid
position when they would enter a Zone or leave the canvas. Escape or pointer
cancellation discards the drag; release commits one validated undoable edit.
Finishing a route or curvature drag preserves the existing Edge selection.
Edge Properties provides Reset curvature to restore the newly created default
curvature and orientation for each selected Edge's current shape. It commits
one validated undoable edit, preserves selection, and is disabled when all
selected Edges already use defaults or the tab is read-only.
These controls appear only for selected Edges in the Edge tool and are disabled
in read-only tabs. Curve badges move along the curve while editing to leave the
midpoint handle accessible.
Edge Properties includes the same color palette control as Zones. Edges default
to Automatic, using canvas luminance; choosing a palette color overrides it for
the path and arrowheads. Use automatic color clears the override. Color changes
apply to selected Edges through validated history. Invalid-route diagnostics
remain red.
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

On desktop, the non-toggle icon-only Engage and Disengage actions sit in the
right sidebar header. When expanded, the actions align left with space between
that group and the collapse button on the right. When collapsed, the actions
stack beneath the expand button, Engage first and then Disengage from top to
bottom. Engage groups the currently selected actors independently per zone: a zone
with fewer than two selected actors is a no-op; otherwise those actors are
removed from their old Engagements, unselected old members remain, and the
selected actors become one Engagement. Any resulting group with fewer than
two members dissolves. The complete operation is one history-tracked action.

On desktop, the non-toggle icon-only Disengage action appears beside Engage
and uses the Lucide `Unlink2` icon. It is enabled when any selected actor
belongs to an Engagement and removes only the selected engaged actors; any
undersized group auto-dissolves in the same history-tracked action.

On compact screens, Engage and Disengage use the canvas action row. When the
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
Engage action uses its active color. The matured actor intent marker is
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

The toolbar zoom-in and zoom-out buttons support the shared hold-to-repeat
behavior: one immediate step, followed by repeated steps after 400ms at 80ms
intervals, stopping at the zoom bounds. Fit and reset buttons remain single
actions. Ctrl + wheel up/down provides additional 10-point zoom steps around
the pointer, independently of the customizable zoom shortcuts. Its switch is
on the Fixed shortcuts row in Keybind settings and defaults on. While enabled,
Ctrl + wheel cannot trigger browser page zoom, including outside the canvas.
Canvas scale and its compensating scroll update together before paint.

A canvas-size mutation preserves zoom and keeps the same proportional canvas
point centered by mapping it through the top-left resize transform. When the
rendered canvas no longer overflows an axis, it centers on that axis.

The canvas viewport scrolls on both axes with scrollbar chrome hidden. The mouse wheel scrolls vertically,
Shift + mouse wheel scrolls horizontally. Keyboard panning uses configurable,
initially unbound directional shortcuts. Right-button drag panning is enabled
by default and can be toggled from the toolbar. A right-click without a pan gesture retains the
active tool's existing context action. While the Ruler tool is active, right-drag
pans without changing placed points; a stationary right-click removes the last
placed draft/edit point. On browsers that emit a context menu on button press,
the context action waits until release so a pan cannot remove a point.

Touch input uses one pointer for the active tool's normal editing gesture and
two pointers for midpoint-preserving pan and pinch zoom. Touch holds anywhere
in the application do not invoke browser or application right-click context
actions; context actions remain available through normal mouse right-click
when testing a compact layout. Touch multi-selection is exposed as a subtool
toggle because modifier keys are not available.
Perception-only touch navigation does not create history.

### 5.7 Keyboard Actor and Viewport Commands

Actor and Select tools support arrow-key zone movement and Shift+- / Shift++
size changes for selected actors. Size steps follow small, medium, large,
xLarge and leave actors at a bound unchanged. Movement preserves complete
Engagements travelling together, disengages partial groups, and commits the
final batch atomically through validation and history. Actor positions remain
derived. Zoneless actors and actors without a directional destination remain
stationary. Paste prefers the copied actor's valid zone, otherwise the selected
Actor target zone, otherwise zoneless.

Directional movement compares zone centers in the requested half-plane. Origins
with any Edges use only connected destinations respecting unilateral direction;
origins without Edges use the nearest directional center. Parallel traversable
Edges combine restrictions: any blocked rule excludes that destination, any
skillCheck requires individual adjudication, and difficult remains informational.
For multiple connected candidates, horizontal movement orders top-to-bottom and
vertical movement left-to-right. Perpendicular arrows cycle with wrapping;
Enter or the original movement key confirms; Escape or the configured movement
key opposite the proposed direction cancels the whole batch without moving Actors. Candidates
pulse their borders and perpendicular chevrons using the animation preference.
The movement-choice border uses the candidate Zone name’s readable text color,
including its sampled background luminance when applicable. Choice chevrons
use readable contrast calculated from the candidate Zone’s fill color luminance.
The top-left HUD shows actor names, origin -> destination, and comma-separated,
deduplicated movement rules and interaction tags in square brackets.

A single “Skill check required” dialog lists affected actors alphabetically,
with centered tokens and names beneath, amber pending/question, red remain/X,
and green move/check indicators. Clicking a token selects it. “Remain in current
zone” and “Move to zone” adjudicate and advance to the next pending actor; the
last pending decision appends “and proceed”. “Move all unadjudicated actors and
proceed” resolves pending actors while retaining existing decisions. No move
occurs until all choices complete. Escape, backdrop, or close cancels the batch.
After adjudication, differing final destinations (including stationary actors)
require “Actor destinations differ” Cancel/Continue confirmation. “Don't show
this warning again” persists only on Continue, resets with Interface preferences,
and can be restored in Combat settings.

H toggles a compact heal/damage dialog in Actor and Select tools with actor
selection. Alphabetically ordered actor names wrap with centered spacing on their
own row below the close button. Minus,
centered positive-integer amount, plus appear above Apply Heal (left) and Apply
Damage (right). Existing HP bounds, skipped-actor confirmation, writer boundary,
and history rules apply. H, Escape, backdrop, and close dismiss without applying.
Successful application closes by default; Combat settings can keep it open.
The Status panel also places the amount decrement control before its value. The amount
field fits its content with a comfortable two-digit minimum; the dialog uses a
compact width to keep its controls close. Enter in the amount field retains the
draft and focuses enabled Apply Damage without applying it. Subsequent Tab and
Shift+Tab use the normal dialog focus order.

L opens the same Library section as the toolbar for the active tool. P pauses
or resumes all active audio and is a no-op without playback. Minus/plus zoom
out/in; Ctrl+Left/Right fit width/height, Ctrl+Up fits the canvas, and Ctrl+Down
resets zoom. Pan directions are initially unbound, replacing implicit focused
arrow scrolling. Keybind settings arrange four pan assignments on one row and
offer atomic WASD/Arrow Keys presets. Conflicts require confirmation before
unbinding displaced editable actions; read-only bindings cannot be displaced.
All navigation is session-only. Text editing and unrelated modal workflows
suppress application shortcuts. Stored existing assignments take precedence
over conflicting newly introduced defaults.

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
- each Encounter persists every panel's dock side, order within that dock, and
  individual expanded/collapsed state; whole-sidebar collapse remains
  session-only
- sidebar widths fit their contents: expanded docks use the panels' width,
  while collapsed docks fit only their header and footer icon controls
- panel insertion previews track the current valid drop destination; hovering
  over the canvas or another non-drop surface previews the panel's original
  position, matching its unchanged placement if released there
- dragging a panel near the top or bottom of a scrollable dock continuously
  scrolls in that direction while more content is available, refreshing the
  insertion preview beneath the pointer; leaving the edge or ending the drag
  stops scrolling without changing encounter history
- the insertion target before the first docked panel previews in the gap
  below the sidebar header without reserving blank space above the panel
- an empty dock retains a narrow drop target so panels can be moved back to it,
  while its sidebar expand/collapse control remains hidden

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

The compact panel launcher is only available below 1024px, while the docked
side panels are hidden.

### 7.2 Panels

- Library
- Initiative
- Properties
- Log (committed actions and blocked validation attempts, categorized for
  filtering)
- Status

Panels update based on selection context. The Library panel can expand only
with the Actor, Background, or Audio tool active. Its expand button is disabled
for other tools; an already expanded panel can still be collapsed.

The Library panel header has an icon-only BookOpen Library launcher immediately
left of the view cycle control on desktop and compact layouts. It opens the same
Library section as the toolbar for the active tool, with desktop hover and
touch-hold help. Opening the Library does not change encounter history.
The Asset Library shows Encounters first, separated by a vertical rule from
alphabetized asset tabs: Audio, Backgrounds, Characters, and Tokens. Characters
currently shows an empty scaffold using the shared asset explorer and card views,
with adding disabled. The future Characters feature will store separate character
records that link to existing token assets and retain state across encounters;
character behavior and its data contract will be specified with that feature.
Interface Settings includes Library preferences: closing the modal by clicking
outside it (initially off), separate modal and panel default views (initially
Grid and Two columns respectively), and a modal card size slider with four
discrete steps: Small, Medium (default), Large, and Extra large. These use minimum
card widths of 80, 128, 192, and 256 pixels so the number of cards adapts to the
available screen width. Older pixel preferences map to the nearest step.
An Independent Library card sizes switch, initially off, shows separate
Audio, Background, Character and Token, and Encounter sliders when enabled, and the shared
slider when disabled. Each individual size starts at Medium. Shared and
individual values are retained when switching modes. Characters and Tokens use
the same card size preference. Card size preferences apply
only to the Library modal. The Library panel cycles through List, One column,
and Two columns; List retains compact rows, and column views show cards filling
one or two equal-width columns regardless of modal card size.
Card grids fit the available width without overflowing compact
screens. Manual modal tab views and panel view choices remain session-only and
take precedence over defaults; new tabs/sessions use the configured default.
Visual assets in the Library preview fit its width and scroll vertically when
taller than the preview area, with the scrollbar hidden. Selecting another asset
resets preview scrolling to the top.
Preferences persist locally, synchronize across tabs, reset with application
preferences, and do not enter encounter history. Clicking inside the Library or
on a nested dialog backdrop does not dismiss the Library. Outside-click dismissal
is suppressed while dragging; the explicit Close button remains available.

Initiative can open in its own browser window through a ContactRound launcher
in the panel header immediately left of its drag control,
or the customizable I shortcut, which toggles the window from either window.
Clicking the launcher while the window is open focuses that existing window.
The window can be closed using its own close control or the I shortcut.
Initiative rows show all active catalog condition icons immediately after the
Actor name, independent of visibility preferences; equipment is excluded. Each
icon shows its condition name and icon in the same compact pill popup used
by the Activity summary, on hover or keyboard focus. If the complete name/icon strip does
not fit, replace the icons with Activity. Hovering or focusing Activity displays
compact, content-sized pills containing every active condition icon and name,
wrapping within the popup and positioned outside the scrolling
list in the owning window. Re-evaluate fit when the row/window size, Actor name,
selection styling, or conditions change.

Clicking a condition icon (including in the Activity summary) asks whether to
remove that condition from that Actor. Confirm removes only that condition through
validation and undo/redo; Cancel, Escape or clicking the backdrop preserves it.
Condition controls do not select or drag Actors. Read-only windows may inspect
conditions but cannot remove them.

While open, its docked panel retains the full Initiative list and controls;
the user can collapse it independently. Both views share the current encounter,
history and selection, and the popout
is session-only, following the Soundboard's portal, stylesheet and theme pattern.
The popout supports horizontal scrolling below its content's minimum width,
keeping controls accessible when the browser window becomes narrow.

The Zoneless actors presentation remains the collapsible, resizable
bottom-center overlay on larger screens and becomes a panel in the compact
drawer. Its show/hide button sits beside Settings in the left sidebar footer,
with space between the two controls. It uses Users Round, with a top-left to
bottom-right slash while the panel is visible to indicate the hide action.
Horizontal resize edges follow the cursor
one-to-one while the panel stays centered. It starts visible and collapsed each
session. Hiding preserves its mounted expansion, grouping, and size; hovering does not reveal it.
Hovering a visible panel makes its background fully opaque, using the current
theme's readable text and border colors. Leaving restores its normal appearance.
Interface Settings includes a locally persisted, cross-tab synchronized
header-click expansion preference, enabled by default and restored on preference
reset. The chevron always toggles expansion; nested controls act independently.
Compact screens retain their existing drawer launcher.

Both Zoneless presentations provide Select All, replacing the current selection
with every listed Actor. With faction grouping enabled, activating a faction
header selects all listed Actors in that faction, replacing selection and
excluding Actors already on the canvas. Repeated activation keeps the faction
selected. These controls support keyboard and touch input and are disabled for
tools that do not support Actor selection. Selection and panel visibility do not
enter encounter history.

A Zoneless transfer includes only selected Actors currently listed in the panel.
Releasing over the panel keeps those Actors unplaced, including after leaving
and reentering it. Dragged Actor visuals render above the panel. Cancelled,
invalid, unchanged, and failed drops create no history. Accepted group transfers
commit atomically with undo/redo.

Starting a touch drag from a Library actor token or Zoneless closes
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
- Ruler properties

Properties-panel Name fields commit on blur or Enter. Escape discards only the
uncommitted typing in that field and restores its last committed value; later
blur must not create an undo step. Field values follow undo/redo and selection.
Typing a Ruler, Zone, or Actor name in Properties or its rename dialog previews the name on canvas labels, selected Zone/Actor names in Status, and Actor names in Initiative, including their popout windows. Other lists retain committed names. Multi-selection rename previews all targeted canvas labels. Previews are session-only, leave EncounterState and history untouched, and are cleared on commit, cancellation, editor unmount, target/tool changes, and encounter load. Committing follows the existing history boundary; a ruler name committed while editing joins that geometry draft, while cancelling its input restores the draft’s last committed name.

Ruler Properties targets the artifact opened by right-click/touch-hold and stays
available after the radial menu closes. An active ruler edit always takes
priority and shows its current draft properties, even if the context target was
cleared. The panel orders sections as Name, Display, Color (including opacity), then Shape. Display places “Highlight actors” above distance text. Shape icons share one row with equal-width compact buttons that fit the panel without horizontal scrolling. Delete ruler and Lock follow the sections as equal-height buttons on one row with space between them; Delete ruler stays on one line, with Lock narrowing when needed; Lock sits on the right and uses the same lock action as Space. Lock is disabled for already-locked rulers, edits with fewer than two points, and read-only editors. The panel has no Edit button.
The Color section has no Save or Cancel buttons. Valid hex/palette choices and completed color/opacity gestures commit directly, with live previews during dragging and one history step per completed gesture. Cancelled gestures discard previews. The radial color dialog retains explicit Save/Cancel. Panel changes during geometry editing join that same draft, commit
once on re-lock, and restore with Escape outside an input. Shape conversion
preserves endpoints, name, and appearance. A Path can become an AoE only when
at most two points are placed; longer Paths must remove points first. Enforce
this at the command boundary and disable unavailable shape controls. The panel
target and appearance previews are session-only, and durable actions require
the writer boundary and shared undo/redo.

### 7.4 Status Panel and Combat Settings

Status can open in its own browser window through a SquareActivity launcher in
its panel header before the drag control. Like Initiative, reopening focuses
the existing window; its close control or browser close ends the popout. The
docked Status panel remains available. Both views share encounter selection,
validated mutations, the writer boundary, and undo/redo. The window is session-only,
copies application styles, follows the current theme, closes with the parent
application, and scrolls horizontally below its content's minimum width.

The Status popout uses a responsive dashboard layout capped at 48rem. Health
status and hit points share a wrapping row; Weapons, Armor, and Movement share another.
Buffs and Debuffs sit side by side with wrapping icons. Individual sections
have maximum widths, and counter rows size to their contents and wrap into
additional rows as the window narrows. Zone and Encounter counters and clocks
use the same compact wrapping resource layout. Resizing changes presentation only.

The Status header includes an Eye toggle immediately left of its popout launcher.
It shows/hides all Actor canvas status indicators: resource bars and Buff/Debuff
badges, including their hover labels/tooltips. Status controls and saved Actor
values remain available. The icon changes to EyeOff while hidden. This global
Canvas presentation preference defaults to shown, persists locally, synchronizes
between tabs, and resets with Canvas preferences outside encounter history.

Status edits short-term actor details, in this order: read-only names, health,
hit points, counters, Conditions, Weapons, Armor, and movement limit. A single selected
Actor exposes all sections. Multiple selected Actors expose names, bulk HP,
and markers; movement limit, health editing and custom counters are hidden. Other selections
show an Actor-or-Zone selection prompt when entities are selected. With no entity
selected, Status shows the Encounter name styled like Actor and Zone status titles, followed by
encounter-scoped Counters and Clocks. These use the same creation, editing, naming, bounds, style,
reset, validation, writer-boundary, history, and responsive layout rules as Zone
resources. Encounter resources remain independent of Zone resources and persist
with the encounter through saves, recovery, duplication, import/export, and cloud
synchronization.

Clicking an Actor image in the Status sidebar or popout pans the main canvas
toward that Actor at the current zoom with a short Motion easing animation.
Reduced-motion preferences make this pan immediate. A new navigation starts from
the current scroll position; manual pan, wheel/touch input, zoom, or canvas-size
changes interrupt the animation. It centers the Actor when possible and
clamps to the nearest available scroll position at canvas edges. The image is a
keyboard-accessible button with action help; an Actor without a canvas placement
has a disabled navigation action. Navigation does not mutate encounter history.

Each selected Actor's name shows its token image to the right when available,
in Status. For a single Actor in docked Status, a 64px image occupies
the right-hand space beside the name and Health status label without adding
height or moving Health status down. It sits vertically centered between the
panel header's bottom border and the Health status icons. In the popout, the
name and health items form one container with the image centered in its own
container filling the remaining space to the right. The image grows into available width up to the name-and-health container's
height, so it never adds height or leaves space beneath the health controls.
It shrinks to a 96px minimum, then hides when it cannot fit beside the container.
When hit points wraps below Health status, the image can reappear in the space
to the right of just the name and Health status. It is centered and height-capped
against that upper group, leaving hit points below without changing its position.
Sizing and visibility follow the actual container dimensions and window
resizing. Multiple selected Actors use inline 20px thumbnails.
All sizes are independent of Actor size and follow the Actor's image shape
and horizontal mirroring. Actors without an image show only their name.

The Actor, Zone, and Encounter counter section is labeled “Counters”.

Actor Conditions starts expanded and can be collapsed from its header. When
collapsed, Buffs and Debuffs show only conditions active on at least one selected
Actor; groups without active conditions hide their label and controls. The
Conditions header remains available to expand the section. Active conditions
retain their existing toggle and mixed-selection behavior.
Collapsed Buffs and Debuffs share a wrapping flex row. Each group takes at least
half the parent width. Collapsed groups arrange condition icons in three columns,
with compact gaps and a thin left divider on Debuffs.

Movement limit increment/decrement controls step to the next higher/lower
multiple of the grid's distance per cell, bounded at zero. Manually entered
limits may still use any nonnegative distance.
Clicking the Movement input selects its value for replacement. Separate
increment/decrement buttons commit without leaving a typing cursor in the input.
These buttons use the shared hold-to-repeat behavior, preserving grid-distance
steps and stopping on release, cancellation, or leaving the control.

A single selected Zone exposes its read-only name, counters, clocks, tags,
and notes in that order. Multiple selected Zones show a single-Zone selection
prompt. Zone counters follow the Actor counter controls, bounds, naming, shared
draft editing, and reset rules below. Zone status fields remain independent when
exporting visual/layout properties to selected Zones.

Zone tags use the same trimmed Enter-created removable pills as Edge tags,
rejecting exact duplicates and ignoring blank entries. Existing tags survive
migration unchanged. Notes use a multiline text field, preserve whitespace, and
save on blur. Both controls follow undo/redo and selection changes.

Clocks have stable IDs, names, integer progress, and an integer segment count
from 1 through 12. New clocks start at zero with four segments; blank names use
the first available Clock N name. Progress stays between zero and segment count,
and shrinking a clock clamps progress. Each clock stores a style: Traditional
(default), a segmented radial progress clock filling clockwise from the top, or
Box, a series of SVG boxes filling in order, or Stack, a vertical stack of
short, wide rectangles filling from bottom to top, or Row, the equivalent
horizontal bars filling from left to right. Stack and Row fit every supported
segment count into the available space: Stack fills the 48px visual row vertically,
while Row stretches across the available visual width. Both distribute their
segments across that full axis. All four styles share a 48px visual row and
equal-height cards, so style changes do not alter card dimensions.
Style dropdowns sort alphabetically: Box, Row, Stack, Traditional; Traditional
remains the default. Traditional clocks use contrasting
dividers between adjacent completed segments, including the closing divider
when full. Box segments use a four-column grid with left-aligned segments,
including partially filled rows. Box segments are vertically centered with the
maximum within the shared visual row.
Arrange clocks as mini cards in a two-column grid with equal-height rows. Each card shows the clock
name, a centered visualization, then the current value and stepping controls
below, with compact padding and gaps between the three rows. All cards use
a vertical flex layout with space-between alignment. Clock cards expose a top-right
red trash button and top-left pen button on hover or keyboard focus, and always on
touch screens. These sit outside normal layout with consistent title space, so
visibility does not shift the name. The pen opens Edit clocks with that clock
selected; edits remain drafts until Save. Deletion removes only that clock through validated history and
the writer boundary. Place /maximum to the right without shifting the visualization horizontally;
include its height when sizing their shared container. Box visuals sit slightly
left of center with more room for boxes on the left, keeping two-digit maxima
inset from the card edge; the maximum retains its confirmed-fill action. All styles use the same
zero-to-segment-count bounds, progress mechanics, and exact current/total value.
The clock editor exposes the style choice. Interface settings > Panels > Status stores
a Default clock style preference, initially Traditional, used only for newly
created clocks (including creation from the shared editor). Existing clocks keep
their own style when that default changes. The preference persists, synchronizes
across tabs, resets with Interface preferences, and stays outside encounter history. Minus/plus
controls support hold-to-repeat; the current value supports inline editing.
Clicking the maximum confirms filling a clock below maximum. When the clock is
already full, clicking that maximum instead offers to reset its progress to zero.
Cancel, Escape, or backdrop dismissal leaves progress unchanged. Completion has no automatic effect.
Clock Add/Edit follows counter draft editing: a shared dropdown, creation and
removal inside the editor, change indicators, atomic Save, and dirty-close
Save/Discard/Keep editing confirmation. All Zone status changes pass validation,
writer enforcement, and snapshot undo/redo; no-op operations create no history.

Health uses the same four ordinal statuses as Initiative, without its removal
action. HP starts unset. Setup defaults current to the first maximum entered;
current and maximum can be edited. Maximum must be a positive integer. Damage
and healing use HeartMinus/HeartPlus and a positive integer amount per configured
Actor. A partially configured selection requires Cancel/Continue confirmation
listing skipped Actors; a wholly unconfigured selection disables HP actions
with an explanation. Clicking a displayed HP or custom-counter maximum confirms
resetting current to maximum; editing maximum uses a separate control.

For a single Actor, the hit points current / maximum value appears in the header
between its label and edit icon. Bulk selection retains per-Actor value rows.
Clicking a single Actor’s current HP or counter value opens an inline input with
the entire value selected. Input accepts digits only; Enter or blur commits
through validation/history and existing bounds. Escape or an empty draft cancels.
Read-only encounters disable inline editing. HP and counter reset-to-maximum
confirmation dialogs initially focus Confirm, allowing Enter to confirm.
Clicking a confirmation backdrop invokes its cancel behavior. For an unsaved
counter draft confirmation, this returns to editing and preserves the draft.
The damage/healing amount input uses minus and plus buttons beside the value
instead of native spinner arrows. Amount stepping stops at 1 and remains disabled
in read-only encounters. All HP and custom counter decrement/increment controls,
including editor fields, support holding to repeat: one immediate step, followed
by repeated steps after a short delay. Enabled tooltips say “hold to repeat”.
Repetition stops on release, cancellation, leaving the button, or reaching an
enabled bound. Apply damage and Apply healing remain single-click actions. In the HP editor,
a RotateCcw control before the current-value minus button resets the draft to
its entered maximum. It requires a valid positive integer maximum and commits
only when Save is selected.

New custom counters may be saved without entering a name: the placeholder
“Counter N” uses the first available integer starting at 1, reusing numbering
gaps without conflicting with an existing name on that Actor. Explicitly
entered names take precedence.

Actor tokens show up to two thin progress bars directly below the token, before
its external name. Resource 1 defaults to current HP / maximum HP; without
configured HP it is hidden. The hit point editor includes a “Health → Resource 1”
switch. Turning health off explicitly records an opt-out that persists while a
counter occupies Resource 1. Switching a counter off Resource 1, including moving
it to Resource 2, restores health unless that opt-out is set. Counter assignments
do not change the remembered health preference. Assigning a counter to Resource 1 replaces health; enabling health replaces
that counter. Resource 2 has no default mapping. Each Actor counter editor has
Resource 1 and Resource 2 switches. A counter can occupy only one bar: selecting
one switch deselects the other, replacing any prior resource in the chosen slot.
Each mapping switch names the resource it would replace in a “Replaces <name>”
hint, using draft counter names and the configured health name. No replacement
hint is shown for an empty slot or the counter already occupying that slot.
The switches are disabled without a positive maximum. Bars display current /
maximum, visually clamped to 0–100% without altering the resource value.
Unmapped bars are hidden. Hovering a bar on a selected Actor shows that resource’s
name immediately to its left, using the configured health name for HP. The label
hides on pointer leave or deselection and does not capture pointer events. Deleting a mapped counter or removing its positive
maximum clears its mapping without restoring health. Mappings belong to each
Actor, persist in schema 30, and commit with editor Save through validated,
writer-guarded history. Counter drafts retain mappings while switching counters;
Cancel discards them. Clones retain mappings to their own copied counters.
Combat settings > Token resource bars sets global custom six-digit hex fill
colors for each bar, defaulting to red (#ef4444) and blue (#3b82f6). Picker edits
save immediately; hex edits save on blur/Enter. Colors synchronize across tabs,
reset with Combat preferences, and stay
outside encounter history. Token footprints and hit testing remain unchanged.
Each resource bar can independently enable amount-based gradient colors instead
of its static fill. Low (0%) and high (100%) endpoints use the same Settings
color picker, hex entry, recent custom colors, and individual default reset.
The visible fill is always one solid color: interpolate the sRGB channels
between the endpoints using the same clamped current/maximum fraction as the
bar length. Values below zero use the low endpoint; values above maximum use
the high endpoint. No spatial gradient is drawn inside the bar.
Static and gradient settings are retained when switching modes. Gradients are
disabled by default, and both endpoints initially use their bar's established
red/blue default until customized. A five-sample preview shows colors from empty
to full. Gradient preferences persist locally, synchronize across tabs, reset
with Combat settings, and remain outside encounter history.


Custom counters have stable IDs, names, integer current values and optional
integer bounds. Create, edit, remove and ±1 controls are available for one Actor.
The header always shows an “Edit counters” pencil immediately before Add counter,
including when no counters exist; rows have no edit or remove icons. The shared editor uses
a counter dropdown whose last option, “Create new counter”, adds and selects
an empty draft counter (current value zero, no bounds, generated name placeholder).
The modal title is “Edit counters”. It keeps all edits and removals in one local draft while
switching counters. Changed counters show a pen indicator only beside their names inside the dropdown.
Save commits the entire draft as one undoable change. Closing a dirty editor
prompts to save, discard, or keep editing; invalid drafts cannot be saved.
Removal is available inside the editor and takes effect on save. On touch devices,
swiping a status-panel counter row right reveals a red fill with a black trash icon
and deletes the counter on release; swiping left reveals a theme-neutral fill with
a contrasting pen icon and opens the editor with that counter selected. The gesture
commits after 30% of the row width (capped at 72px), or a same-direction flick
of at least 20px at 500px/s. Shorter gestures return to rest. Vertical scrolling
and value controls remain available; read-only rows cannot perform swipe actions.
Minimum must not exceed maximum; all changes clamp to configured bounds. Clones
retain values and subsequent changes remain independent. In the counter editor,
stepping an empty current or minimum field in either direction first sets it
to zero. An empty maximum starts at 1 when incremented and 0 when decremented;
subsequent steps change it by one. Optional minimum and maximum fields each
have an X control to clear that bound, committed only when the editor is saved.
Current value has ArrowDownToLine and ArrowUpToLine shortcuts after its plus
control: set to minimum (zero when unset) and set to maximum. Their tooltips are
“Set to minimum” and “Set to maximum”. Without a minimum, the former adds
“(0 by default)”. Without a maximum, the latter is disabled and retains the
“Set to maximum” tooltip. Current-value decrement/increment buttons and keyboard
steps stop at the configured minimum/maximum; clearing a bound re-enables stepping
in that direction.
Shared Systems templates
are future work.

The 40 approved Conditions in `plans/status_panel.md` are independent markers,
grouped into Buffs and Debuffs in the Actor Status panel, each sorted alphabetically
by display label with a muted subsection heading. Buffs are Aiming, Assisted /
Helped, Blessed, Bolstered, Cover, Disguised, Enchanted, Energized, Flying,
Guarded / Shielded, Hasted / Quickened, Hidden / Concealed, Inspired, Invisible,
and Resistant. Canvas tokens show active Buff icons at the upper left and active
Debuff icons at the upper right, using the same catalog and alphabetical order.
Small and Medium tokens use two columns per condition group, extending outward
as needed to keep Buffs and Debuffs separate. Compact badges wrap upward above
their respective corners and stay upright in
isometric views. On selected Actors, hovering a condition badge immediately
shows its name using the Status panel tooltip presentation; leaving the badge
or deselecting the Actor dismisses it. Touch hold retains condition-name help.
These indicators do not change the token footprint or placement.
All remaining approved conditions are Debuffs, including
Concentrating and Stunned (Galaxy). Empty subsections are hidden. Actor Status
heal/damage buttons use wider horizontal padding with the standard height and
icon size.
Weapons are independent Fist, Single-handed melee weapon (Sword), Dual wielding
melee weapons (Swords), Two-handed melee weapon (Axe), Ranged projectile weapon
(BowArrow), and Magic Focus markers. Existing weapon marker IDs remain stable.
Magic Focus uses the Wand icon and the `weapon:magic-focus` marker. Armor tiers
are No armor, Light armor, Medium armor and Heavy armor, with at most one known
tier per Actor. Bulk toggles clear a marker if all selected Actors have it;
otherwise they apply it to all. Selecting armor replaces other known tiers;
clearing armor does not select No armor. An independent Shield toggle follows
the armor tiers, using ShieldEllipsis with a “Shield” tooltip and the
`armor:shield` marker. Toggling Shield preserves armor tiers, and changing armor
preserves Shield. Unknown marker strings are preserved.
Markers have active/inactive/mixed accessible states and descriptive tooltips.
Condition, weapon, and armor icon tooltips appear immediately on pointer hover
or keyboard focus, remain within the viewport, and retain touch-hold help.

Combat settings > Health persists a global Health counter name, defaulting
to “Hit points”. Trimmed empty input restores that default; the label is not
stored separately on Actors.

Combat settings persist global HP limits: clamp at zero and maximum (default),
allow negative but cap at maximum, or allow negative and above maximum. These
limits apply to every HP change, including direct edits and maximum changes.
Damage is disabled at or below zero when the minimum is capped; healing is
disabled at or above maximum when the maximum is capped. For bulk selection,
disable a direction only when every configured Actor is at that limit. Uncapped
directions remain enabled, and disabled controls explain the reached limit.
Automatic health starts off with no preset thresholds. Each Dead,
Unconscious/severely injured, or Injured cutoff is optional: a blank cutoff never
triggers that status, so assigning it requires manual selection.
The “Automatically update health status” switch is the first setting in its
subsection and gates the threshold units, cutoffs, and related help. Enabling it
reveals these controls, even when no cutoffs are configured. Disabling it hides
them and preserves saved thresholds. Clearing every cutoff leaves the switch
enabled but performs no automatic status changes. Configured cutoffs must be
ordered by severity, skipping blanks, using one
shared fixed-HP or percentage-of-maximum unit. Fixed values are integers;
percentages are integers from 0–100. Nonempty percentage cutoff inputs display
a % suffix directly after the number; empty inputs and fixed-HP cutoffs do not.
The number (or number and % together) is centered in the field, with repeatable
minus and plus controls on its left and right. These steps save immediately and
percentage steps stop at 0 and 100. An X button before minus clears that cutoff
and saves immediately; it is disabled when empty. Enter blurs the input, saving
valid cutoffs through the same validation as leaving the field. Ties choose the
most severe configured
status; values above all configured cutoffs are Healthy. Manual status selection
applies immediately without disabling future automatic triggers, including
when the manually selected status has no configured cutoff.

Combat settings save toggles/selects immediately and cutoff inputs on blur.
Invalid cutoffs remain editable but do not replace the last valid preferences.
There are no Save combat settings or Apply to current encounter buttons.
Enabling automation or changing its valid cutoffs/units automatically recalculates
all configured Actors’ statuses in the current encounter without changing HP,
through validation, writer guards and one undoable history command. No-op
recalculations create no history. HP-limit changes apply to subsequent HP edits.
With automation enabled, effective current/maximum HP changes also recalculate
health. Manual overrides persist until an effective HP change or cutoff recalculation; no-op HP commands preserve them.

Interface settings > Panels > Status autosaves global Status panel visibility. All conditions
and equipment sections are shown by
default. Conditions are individual icon toggles in an alphabetically sorted,
wrapped row; the Status panel sorts within its Buffs and Debuffs subsections. Eye/EyeOff section controls match
Interface panel visibility controls: Conditions is a master override preserving
individual condition choices; Weapons and Armor each show/hide their complete
section. Hidden conditions still appear if active on any selected Actor,
including mixed selections; they disappear again when no selected Actor has
that condition. The Conditions section is hidden when it has no visible conditions. Hiding equipment removes its section even when equipment is
active. Visibility never alters Actor markers or creates history. These global
preferences reload, synchronize across tabs, and reset to showing everything.
Preferences themselves do not enter encounter history and reset with local data.

Encounter schema 13 adds optional HP and normalized counters. Version 12 migration
leaves HP unset and initializes empty counters. Persisted HP may be negative or
above maximum regardless of local preferences. All domain mutations pass through
validation, Redux history and the writer boundary; bulk changes and HP plus
health changes are atomic. Resources and unknown markers survive local and cloud
round trips. Encounter schema 14 adds Zone counters, clocks, and notes. Migration from schema
13 initializes empty counter/clock collections while preserving tags and all
other encounter fields. Encounter schema 16 adds normalized encounter counters and clocks; migration
from schema 15 initializes empty collections without changing Zone resources.
Encounter schema 15 adds clock style; migration from schema 14 sets missing
styles to Traditional without changing progress or segment counts. Missing
legacy styles render as Traditional. The Firebase API accepts schemas 16, 15,
14, 13, and legacy 7, and validates encounter resources in schema 16 and clock
styles when present.

### 7.5 Soundboard trigger updates

Soundboard group headers have a Play/Pause control immediately left of the drag
handle. An idle group can start all its cues; Music starts its first track only.
Pause/resume applies to that group with the existing section transport behavior.
Track cards have Stop to the left of Play/Pause; Pause retains the seek position
and Stop resets playback. A paused track’s Play control resumes that track alone
even when its group or section is paused, leaving other cues paused.
Audio Settings groups creation preferences under Cue defaults, including cue volume
and Effect repeat delay. Music cue Repeat defaults off; new Music group Loop
defaults on. Both are switch preferences, apply to newly created cues/groups,
and reset with application preferences. Existing cue/group values are preserved.
Ambience cue type defaults offer Asset Icon (initial default), Duration threshold,
Effect, and Track. Library Music icons mark Track assets and Audio icons mark
Effect assets. The asset context menu offers Mark as Track or Mark as Effect
according to the current mark; links share their original asset's mark.
Duration threshold is an independent Audio Cue defaults setting, always editable
regardless of the selected default type. It starts at 30 seconds: strictly longer
sounds become Tracks, and equal/shorter sounds become Effects. Unavailable
metadata falls back to the asset mark. Defaults apply to newly created Ambience
cues with no explicit tool type; explicit Track/Effect choices take precedence.
The Audio tool has a FileHeadphone Use asset cue type button, followed by a Timer
Use duration threshold button, then Track and Effect. Asset mode classifies each
cue by its asset mark; Timer mode uses the same saved duration threshold as
duration-based Soundboard additions, including the asset-mark fallback. Zone/Actor groups remain
Effect-only and Music remains Track-only. Classification does not modify
existing cues or add a second persisted type to Library assets.

Creating an audio group scrolls the Soundboard to reveal the entire group below
its sticky header. Actor audio combines entering and leaving a zone into one
“Changes zones” trigger. “Takes damage” fires when the Status panel's Apply damage
command reduces an Actor's hit points; manually setting hit points does not fire
that trigger. “Health status becomes” contains independent icon toggles for Dead
(Skull), Unconscious / severely injured (BoneFracture), and Injured (HeartCrack),
using the same names and icons as the health controls. These health triggers fire
when the Actor changes to the selected status. Undo/redo does not play triggers.

## 8. Themes

Settings color controls for resource bar fills, default Zone fill/border/Engagement
colors, and ruler appearance use an expandable saturation/brightness area, hue
slider, screen eyedropper, swatches, and manual hex entry. The eyedropper is
disabled when unavailable in the browser; cancelling it leaves the color unchanged.
The hue bar has no border and uses a white circular knob with a subtle edge
and raised shadow to show the selected hue. Shared pickers place the hue bar
on its own row directly above the hex input
and screen eyedropper row, followed by preset and recent swatches. Hex entry
stays available when the spectrum is collapsed. Settings pickers omit a repeated
heading above their trigger; reset buttons sit to the right of the hex input
and eyedropper. Picker changes save immediately and keep the
picker expanded. Each color has an
individual reset to its existing default: red/blue for resource bars, inherited
Zone defaults, or theme-based ruler color. Resetting ruler color preserves opacity.
Blank Zone default hex values retain their existing fallback behavior.

Expanding a color picker in a scrollable panel reveals the whole picker with the smallest necessary scroll when it fits the visible area. If it is taller than the available area, align its top with the visible area instead. Already-visible pickers do not move the panel. Scrolling follows motion preferences and never repeats during color adjustments.

Shared color pickers use small rounded-square swatches with tight spacing:
three rows of seven fixed presets, ordered with light-to-dark neutrals first
and then chromatic colors around the hue spectrum. The 21 presets use the
original Zone palette without #fde68a and #fecaca, adding black, red, and blue.
A fourth row of seven slots shows the most recent custom colors, newest first, with
empty slots reserved until colors have been chosen. History is shared across
Settings color pickers, deduplicated, excludes preset colors, persists locally,
and synchronizes across tabs. Only completed pointer/keyboard selections,
screen picks, and committed hex edits enter history, not intermediate drag
values. Selecting a recent color moves it to the front. Individual color resets
do not clear history; Interface category reset and full preference reset clear it.

- Light
- Dark
- System default
- Extensible theme system (future)

Canvas settings > New encounter defaults > Zone appearance optionally persists default Zone fill and border colors as
six-digit hex values and persist a default Zone opacity from 0–100%. Canvas Settings opacity sliders (default Zone and Ruler) accept continuous values without fixed increments. Blank
Zone fill or border defaults use the first color in the Zone palette. The
optional default Engagement color is blank by default: new Zones then match
their Engagement color to their border. Setting an Engagement default creates
new Zones with matching disabled and that independent color. Empty color
fields display the effective default hex value as their placeholder. Cloned
Zones retain the source Zone's opacity instead of applying the new-Zone
default. A Show border setting, enabled by default, controls border visibility
for newly created Zones; clones retain their source Zone's setting.
Canvas settings > Edges > Edge thickness uses whole canvas units from 1 to 8,
defaulting to 1. Selected Edge paths are one unit thicker. Arrowheads scale with
the configured base thickness and do not grow on selection. Free-drag preview
paths also use the extra unit, preserving their existing appearance at the default.
The preference persists locally, synchronizes across tabs, resets with Canvas
defaults, and stays outside encounter history. Invalid saved values use 1.

Canvas settings > Selection > Select on undo/redo is disabled by default.
When enabled, undo and redo select existing elements changed by the restored
snapshot, using the action's primary entity type for cascading changes.
Removed elements cannot be selected; if no affected elements of that type
remain, existing selection is only pruned for invalid references. Actions
without a selectable primary entity type preserve valid selection. Switch
to Select only when the active tool cannot select the affected type.
This browser-local preference persists, synchronizes across tabs, resets with
Canvas defaults, and stays outside encounter history.
Canvas settings > Selection outlines provides separate Selected Actor outline
and Selected Zone outline choices: Static (default), Pulse, and Pulse limited.
Pulse varies only the selection outline's opacity continuously; Pulse limited
runs two one-second pulses when an entity becomes selected, then leaves its
outline fully visible. Other entity updates do not restart those pulses.
Reselecting an entity or changing its outline mode restarts its animation.
Separate Actor and Zone outline thickness sliders use whole canvas units from
1 through 8 for Actors and the current Zone border thickness through 8 for Zones,
defaulting to Actor 2 and Zone 3.
The Zone slider minimum matches the normal Zone border width and displays that
minimum for older saved values below it. Zone outlines retain their dashed
stroke.
Rendered Zone selection outlines are never thinner than the normal Zone border
(default 2 canvas units), even when the saved selection thickness is lower.
Canvas settings provide separate normal border thickness controls for Zones and
Actors alongside Edge thickness, each using whole units from 1 through 8. Defaults
remain Zone 2, Actor 2, and Edge 1. These browser-local preferences reset with the
Canvas category and do not enter encounter history. Hidden Zone borders remain
hidden. Selected Actors retain their existing two-unit increase to the normal
border, separate from the selection outline thickness setting.
Zone selection outlines use the readable color calculated from their border
color's luminance, falling back to the Zone name's color when no border color
exists. Actor selection outlines use the Zone name's luminance-derived readable
color; zoneless Actors use the canvas background luminance.
These browser-local preferences persist and synchronize across tabs, reset with application
preferences, and stay outside encounter history. Unknown saved modes use Static; invalid thicknesses use their entity defaults.
Disabled animations and the existing reduced-motion policy render both outlines
statically while retaining the saved choices.
The same Canvas section provides a separate Selected Edge arrow choice:
Static (default), Pulse, or Pulse limited. It animates the selected Edge's
arrow path and arrowheads with the same opacity timing and accessibility
overrides as Actor and Zone selection outlines. Badges and route diagnostics
remain steady. This browser-local preference follows the same persistence,
cross-tab synchronization, reset, and invalid-value fallback rules.

Settings use a consistent Category → Section → optional Subsection → Setting
hierarchy, described in `plans/settings_consistency.md`. Workspace categories
are Audio, Canvas, Combat, Interface, and Keybinds; Account and Data are grouped
separately. Settings navigation remembers the selected category and its scroll
position when closed and reopened during the active application session. This
navigation state is not stored durably and resets on refresh.
Each Workspace settings category (Audio, Canvas, Combat, Interface, and
Keybinds) has a Reset to defaults action with a confirmation dialog. Cancel
preserves preferences; confirming restores only that category's defaults,
including preferences owned by shared providers. Category resets preserve
encounter data and history. Interface reset restores presentation defaults
without applying the default panel layout to the current encounter; Combat
reset disables automatic health without recalculating existing Actor status.
Account and Data do not provide category preference resets.
Keybind preferences persist only custom overrides, including intentionally unassigned shortcuts. Inherited defaults follow application updates. Legacy snapshots migrate the previous Rename R, Ruler D, and Annotation N default assignments to the current defaults, preserving different custom bindings. A defaults revision distinguishes those legacy snapshots from intentional overrides saved afterward.
Interface > Panels > Default layout edits the default left/right panel arrangement by dragging panel
names, with a line preview at the drop position and no arrow controls. Its last
control, Apply to current encounter, applies those sides and order to the active
Encounter through undo/redo while preserving each panel's expanded/collapsed
state.
On layouts narrower than the shared 1024px compact breakpoint, the Settings
section navigation starts collapsed to icons, can be expanded for selection,
and collapses again after a section is selected.

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

### 10.1 Controls and interaction safety

- Undo and Redo are icon-only controls, in that order, immediately to the right
  of the expanded left sidebar collapse button. With the sidebar collapsed,
  they stack vertically beneath its expand button. An empty left dock retains
  the vertical history controls while its sidebar toggle remains hidden.
- Below 1024px, Undo and Redo appear horizontally at the canvas top-left; the
  canvas status badge sits below them. Controls have desktop tooltips,
  touch-hold help, and visible keyboard focus.
- Configurable shortcuts default to Ctrl/Cmd+Z for Undo and Ctrl/Cmd+Shift+Z
  for Redo. Text editing retains native undo/redo, and modal workflows retain
  their keyboard handling. Repeated history keydown events are ignored.
- Controls are disabled when their history stack is empty, the workspace is
  read-only, or an operation is unfinished. History replay waits for active
  canvas drafts, drags, transfers, grid calibration, asynchronous mutations,
  and mutation approval workflows to finish or cancel. Settled return
  animations do not delay replay.
- Asynchronous results and approval callbacks must honor the writer boundary
  and must not overwrite a newer encounter snapshot. Failed or cancelled
  operations release their history blocker.
- After replay, retain selected entities that still exist and remove invalid
  session references. Redo does not automatically reselect restored entities.
- Ineffective commits do not create history or erase redo. Selection, viewport
  navigation, tool choices, interface preferences, and standalone Library
  records retain their existing separate behavior. History is session-only
  and starts fresh when an encounter loads.

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

Cloud sync is optional monetization and preserves IndexedDB as the local source
of truth. Signing in with Google starts synchronization after an entitlement
check. The active encounter remains device-local; saved encounters, the
Library, the recovery draft, and the five most recently accessed saved
encounters synchronize through Firebase.

When local and cloud workspaces both exist, the user chooses Merge, Use cloud,
or Keep this device. Merge is the primary option. Replacement always creates a
recoverable backup first, and replacing cloud data requires the exact phrase
`REPLACE CLOUD DATA`. Concurrent valid edits are preserved as clearly named
conflict-copy encounters rather than silently overwritten.

Uploaded images use private Firebase object storage and count against the
authenticated user's storage allowance. Google Drive images remain live links
owned by the user, become accessible after incremental Google authorization,
and are not copied into application storage unless the user explicitly chooses
to upload a copy. Local reset signs out and removes local synchronization state
without deleting cloud data.

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
2. Grid
3. Zones
4. Edges
5. Engagement layer (connectors and tokens)
6. Actors (free-floating and engagement participants)
7. Annotations
8. UI overlays

Within the Actor layer, unselected Actors’ external names, resource bars, and condition
icons render below all Actor tokens. Selected Actors’ names, resource bars, and
condition icons render above all Actor tokens. These overlays follow their
Actor during dragging and animated placement changes.

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
  - With exactly one active faction section and no Engagements, use the
    corresponding non-split strategy, including its spacing defaults.
    Hero and Ally share one faction section. Retain the saved split strategy
    so additional factions automatically restore splitting. Engagements retain
    their dedicated sections even when all actors belong to one faction.
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

In Zone movement, Actor and engagement positions inside zones are not persisted
in EncounterState. Unlocked actor coordinates follow §17. Layout strategies derive render targets from the normalized
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

## 17. Encounter Placement Rules and Grid Layer

An Encounter owns one independent `grid` configuration and `movementRules`:
`zoneLocked`, `snapToGrid`, `snapZoneVertices`, `allowOverlap`, and `trimTokens`.
These are independent rules shared by all actor-editing tools, not mutually
exclusive movement modes. New encounters default to Zone lock on and all other
rules off. Canvas settings can change defaults for future encounters.

Zone and Grid are separate toolbar tools, with Grid immediately to the left of
Zone and a vertical separator between them. Selecting either does not change the
rules. Zone begins with a separate Lock/Unlock group, followed by its shape
subtools with VectorPolygon for Polygon and Waypoints Cell Tracer last in that
group. Grid contains Eye, Magnet (Snap Actors and Rulers to Grid), and VectorSquare
(Snap Zone Vertices to Grid) together; Blend (Overlap); LayoutGrid alignment
followed by Grid Settings together; and Scissors (Trim). Background has no grid subtools. Zone, Edge, and Engagement
features remain available regardless of Zone lock. The old cycling button and
Free tool are removed.

With Zone lock on, actor placements remain derived from automatic Zone packing.
With actor snapping too, packing reserves disjoint actor anchor-cell sets inside Zones,
retaining layout strategies, split sections, orientations, and permitted
Zone auto-resizing. Each reservation includes all four square/three hex cells
for Large and all nine square/seven hex cells for xLarge. Full actor footprints
must fit inside the Zone and canvas. Artwork may extend beyond its reserved
cells. Locked arrows retain existing
Zone/edge destinations, followed by packing. Actors placed outside all Zones go
to the Zone list. Zone lock forces Overlap off and disables its control;
unlocking does not restore Overlap automatically.

Moving a Zone preserves every edge vector by applying one translation to all
vertices. With vertex snapping enabled, regular square/hex grids snap that
translation to the lattice, including rotation. On warped grids, snap the
starting drawing control and translate rigidly; reject and log any move whose
remaining controls cannot stay snapped. Never resnap vertices independently
as part of a move. Reshaping and grid geometry edits retain vertex reconciliation.
After a Zone drop, its geometry and drag offset settle from the drop position to
the final position with the same Motion spring as Actors. Direct dragging remains
immediate, and reduced-motion preferences disable the settling animation. Keep
the requested snapped position as a transient preview while asynchronous
validation runs. The actual encounter changes only after acceptance; rejection
animates back to the original position. Connected Edge routes update against
the transient geometry during movement and validation, then the accepted position.
For locked Zones with Actor snapping off, rigid moves preserve Actor packing.
Their acceptance checks run before release returns, with render-only Edge
diagnostics left to the route worker. A valid drop becomes the next gesture's
baseline immediately, independently of settling. A subsequent drag freezes the
Zone at its visible position and supersedes earlier pending gesture work. An
invalid drop returns to the last accepted placement, not the start of earlier
movements. Each accepted drop remains a separate undoable movement.
A released resize waiting for validation remains a separate undoable edit when
another gesture starts. The next gesture starts from its displayed resized shape
and keeps Actors following that shape. Its final move is validated against the
accepted resize, or the prior valid size if the resize is rejected. Earlier
completion callbacks cannot clear the newer gesture or restore stale geometry.

With Zone lock enabled, resizing previews Actor centers proportionally within
the Zone's displayed bounds, using the original-to-preview bounds transform.
Actor artwork and token sizes remain fixed; Engagement tokens and participant
connectors follow the same transform. This is transient visual feedback and
does not pack Actors or change encounter history during the gesture. Release
retains the normal validated Actor-fit and final placement workflow. Final Actor
placement animates from the visible resize preview, retaining that preview while
packing is pending.

While a Zone shape or polygon/Cell Tracer draft is being drawn, or a Zone is
being moved or resized, fade out the canvas Zoneless panel. Fade it back in when
the interaction completes or is cancelled, preserving its expansion and sizing
preferences. Use a 200ms Motion ease-in-out fade and make it immediate when
animations are disabled. Keep the panel mounted; disable pointer, keyboard, and
accessibility interaction as soon as hiding begins so it cannot obstruct editing.

With the Zone tool active, double-click within 12 screen pixels of an existing
polygon Zone edge to insert a vertex at the clicked point. Double-click within
12 screen pixels of a vertex to remove it; vertex hits take priority over edges.
Retain at least three vertices. New vertices must be at least 24 screen pixels
from every existing vertex, measured after grid snapping when enabled. Screen
distances remain consistent at every zoom. This editing applies only to polygon
Zones, without converting generated shapes, and uses the validated, undoable
reshape workflow. Reject edits that self-intersect, leave the canvas, overlap
another Zone, or violate snapping. Existing multi-point drawing drafts retain
their double-click completion behavior.

With Zone lock off, optional Actor `spatialPosition` coordinates are authoritative.
Unlocking initializes coordinates from settled placements. Actors without a
position remain in the Zone list. Manual movement updates Zone membership,
ignores edges, and preserves Engagement membership; engagement/disengagement
must use buttons or hotkeys, without drag-over activation or automatic
disengagement. Unlocked Zone moves/resizes leave actors stationary and reevaluate
membership; deletion clears membership but retains positions. Unlocked
Engagements may span Zones, keeping `parentZoneId` as their home Zone and deriving
visuals around manual positions. Locking attempts to fit members into that home
Zone. If the group cannot fit, dissolve it and resolve each actor individually;
group failure alone does not unplace actors.

With actor snapping on and Overlap off, identical anchors are occupied. Move to
the nearest fitting open anchor, breaking distance ties top-to-bottom then
left-to-right, and log the adjustment. Reject an ordinary move atomically if no
anchor fits.

For unsnapped movement, Overlap affects only multi-Actor transfers from the
Zoneless panel: when disabled, pack those Actors near the release point in
stable panel order, using their existing footprints with a 10px gap, avoiding
placed Actors and keeping every footprint inside the canvas. Use deterministic
nearest-first candidate search, breaking distance ties top-to-bottom then
left-to-right; reject the entire transfer if any Actor cannot be placed.
Single-Actor transfers and subsequent unsnapped movement retain their existing
behavior. With Overlap enabled, unsnapped transfers retain their requested
positions.

Rule changes attempt valid placement and existing permitted auto-resizing before sending actors that
still cannot fit to the list. Every change and cascade is one history action.

Zone vertex snapping is independent of actor snapping and Zone lock. Enabling it
snaps existing Zones and repacks actors atomically, rejecting invalid results.
Polygon Zones snap every stored vertex to the nearest cell vertex, including
collinear vertices. Merge consecutive vertices that snap to the same point,
including the closing first/last pair; reject fewer than three distinct vertices,
self-intersection, or other invalid geometry. Rectangles, hexagons, and circles
snap all four corners of their oriented bounds controls. These corners are solved
jointly so the generated shape is preserved; width and height may adjust
independently to achieve a valid fit. Rotation release also permits a nearby valid
angle, updating the stored angle and label. Resizing retains the current rotation
and keeps the opposite control fixed. Circle
and hexagon outline samples, intermediate generated edge samples, and side-handle
midpoints need not coincide with grid vertices. Reject edits when no valid bounds
can be found rather than accepting off-grid controls or shearing the shape.
Maintain these constraints
through Zone movement, grid changes, map resizing, and automatic enlargement,
including rotated and warped grids; reject operations that cannot remain valid.

Canvas settings offers actor-center, anchor-cell-center, and geometric token/Zone
overlap membership tests. Cell-based membership has an unsnapped fallback of
actor center (initially) or geometric overlap. Small/Medium use their center cell;
Large uses all cells sharing its snapped intersection/vertex; xLarge uses its
center cell plus eight touching square neighbors or six hex neighbors.
Draggable, keyboard-reorderable deciders default to Most shared cells, Nearest
Zone Center (polygon centroid), Keep current Zone, Ask Me. Each narrows candidates
and passes ties onward; skip shared-cell counting without actor snapping.
Ask Me offers fallback when another decider follows. Exhausted unresolved choices
open a final dialog without fallback; Cancel cancels the complete action.
Preferences apply to future membership actions and synchronize across tabs.

Cell Tracer previews its closing route when hovering the starting vertex.
Cell Tracer is available only with Zone vertex snapping on and an unwarped grid;
actor snapping is independent. Snap selected points to vertices and route along
square/hex cell edges, including rotation. Prefer fewest edges, then fewest turns,
then stable top-to-bottom/left-to-right order. Insert vertices at intermediate
turns. Right-click removes the last selected point and its entire incoming path.
Preview the route and trace the closing segment using normal Polygon completion
gestures. Canvas settings defaults to rejecting invalid routes; an alternative
finds the shortest valid detour within bounds, avoiding Zone overlap and
self-intersection. Reject selections if no route exists. Switching drawing mode,
disabling vertex snapping, or introducing warp clears the draft. Save the result
as an ordinary polygon without a tracer marker or persisted control points.

Trim is available only with actor snapping, and disabling snapping turns it off.
Clip Large/xLarge hex artwork to its anchor-cell union. Square, isometric, and Small/Medium
tokens do not require clipping. Trim changes neither hit testing nor footprint
validation.

Grid supports square, pointy-top hex, flat-top hex, and configurable isometric geometry. Configuration
includes `type`, positive `cellSize`, `origin`, `rotation` in degrees, `visible`,
hexadecimal line `color`, and `opacity` in [0,1]. An optional bilinear `warp`
stores two four-coefficient maps of normalized lattice coordinates; absence
means standard alignment. Cell size is the map-scale value described above.
Origin is a square/isometric vertex or a hex center. Isometric grids project
square lattice coordinates using x=(u-v)/2, y=(u+v)×tan(angle)/2 before origin and rotation;
they retain square adjacency and full-cell reservations. Defaults are 64-unit squares at (0,0), zero rotation, hidden lines,
#808080 color, and 0.5 opacity. Grid visibility is independent of snapping; hiding lines does not disable snapping. A separate SVG Grid Layer renders above Background
and below Zones, clipped to the canvas. It works without a background image.

Grid Properties appears when the Grid tool is selected and contains type,
line style, line color, and line opacity. Type changes commit immediately without Apply.
Color and opacity preview in transient interaction state and commit once when
focus leaves their control. Line style commits immediately. Line color retains its native color input; clicking
it again blurs the field, closes its picker, and commits its draft.
Grid Settings retains all existing fields in an Apply/Cancel form with transient
preview. Isometric also offers a projection-angle field from 1–45°. Detection
estimates this angle automatically; manual alignment uses the configured angle. Alignment temporarily owns previews and disables Properties editing.
Configured zoom-in/out, fit, fit-width, fit-height, and reset shortcuts remain
active while Grid Settings is open, including focused fields; other shortcuts
retain modal protection.
Opacity uses the Zone-style percentage slider;
visibility uses a switch. Increment/decrement first reaches the next integer
in that direction, then steps by one, except rotation. Rotation clicks step by
0.1 degrees; holding for 400ms repeats every 80ms, continuing by 0.1 degrees
until reaching the next whole degree without overshoot, then stepping by 1
degree until release.
Rotation values round to the nearest hundredth. All grid types accept a full
turn, wrapping 360 degrees to 0 and decrementing below 0 to the end of the turn.
Calibration
snaps angles within five degrees of a multiple of 45 degrees to that angle.

The LayoutGrid alignment subtool offers simple or four-quadrant alignment.
Grid Settings is a toggle: its subtool is active while open, and clicking it
again closes the dialog and cancels its unapplied preview. The LayoutGrid
subtool also shows its active state; clicking it again cancels alignment,
clearing sampled points and its unapplied preview.
The user selects Square, Hex flat, Hex pointy, or Isometric (last) before choosing Simple,
Four-quadrant, or Detect Grid. Selected compact toggles have a checkmark and
distinct fill. Square/isometric alignment uses all four consecutive vertices around one
cell; hex alignment uses three consecutive vertices. Four-quadrant alignment
repeats this in top-left, top-right, bottom-right, and bottom-left cells, for
sixteen square/isometric clicks or twelve hex clicks. A jump button initially
navigates to the far top-left corner, then advances to top-right, bottom-right,
and bottom-left after each completed cell. It remains available while sampling
the current quadrant, preserves zoom and temporary zoom restoration, and hides
after all samples are placed. Right-click removes the last point and updates
the required jump destination. Reset returns the jump destination to top-left.
The instruction panel can be moved by its handle or keyboard arrows to uncover
vertices. A temporary maximum-zoom button sits to the right of the vertex
instructions and sets viewport zoom to 400%. Closing alignment (including Apply,
Cancel, Escape, or the LayoutGrid toggle) restores the previous zoom unless a
subsequent manual zoom command takes over. Changing alignment strategy does not
close the panel or restore zoom. This changes only the session viewport.
Detect Grid sits beside the two manual strategies; Apply is separated
from Cancel/Reset on the right. All samples fit a standard grid
and optionally a smooth bilinear warped grid. If residual distortion exceeds
3% of cell size (or one canvas unit, whichever is larger) and the warp is safe,
the user must explicitly choose standard or warped alignment before applying.
Both choices preview the result. Folded, singular, or non-invertible warps
cannot be applied; the regular fit remains available. Warping is an alignment
strategy within Grid, independent of actor and Zone rules.

Warped grids transform cell boundaries, snapping anchors, and adjacent-cell
keyboard movement together. Tokens retain the same footprint and regular
shape in every warped region. Manual origin/rotation edits transform the
warped grid as a whole; cell-size edits resize map coverage inversely; settings can
return to standard alignment. Background/canvas resizing leaves grid size,
rotation, normalized warp
coefficients, and saved actor positions fixed. Edge completion may translate
all coordinates together without changing relative placement.

Grid detection analyzes background pixels locally and offers a detected
regular grid of the selected square/isometric/hex type as an uncommitted preview.
It checks a thumbnail and, for larger images, a higher-resolution pass up to
1,152 pixels without enlarging the original. Higher-resolution matches take
precedence to reduce downsampling artifacts and spacing aliases. Faint line
edges remain candidates rather than filtering down to only intersections.
Square detection can fall back to local dark-line ridges with capped contrast
and terrain-trend removal. Projection support is normalized to prevent diagonal
pixel sampling from creating a false repeating pattern.
Analysis runs in a cancellable worker; closing alignment aborts it and cannot
publish a stale preview or change the Encounter.
It requires reliable repeated line families; highly distorted, unreadable,
or undetected images use vertex alignment.
Numbered markers, live preview, reset, Apply, and Cancel/Escape support
calibration. Degenerate points cannot be applied. Configuration previews,
detection drafts, and calibration clicks are session-only.

Actor snapping places Small, Medium, and xLarge actors to cell centers. Large
actors snap to square intersections or hex vertices shared by three cells.
Token diameters/rectangle widths remain: 45, 60, 120, and 180
logical units for Small, Medium, Large, and xLarge. Disabling actor snapping permits any position when Zone lock is off. Warping affects snapping and cell geometry,
never actor size. Actor anchor occupancy follows the Overlap rule when snapping is enabled. Every token's full footprint
must stay inside the canvas in all validation modes. Invalid operations are
rejected atomically. Fully contained outer cells remain available; partial
edge cells cannot accept a token whose footprint would extend beyond the
canvas, even when its center is inside. Applied grids automatically complete
all cells with positive-area overlap with the background, or with the original
canvas area when no background exists. There is no percentage threshold or
manual side control. Canvas bounds extend by at most one perimeter cell's
projected extent on each side, without scaling the background or grid.
For hex, rotated, and warped grids, only those completed cells render;
fragments outside their potentially irregular outline are hidden. The
background's saved frame defines coverage. Without a background, an optional
Encounter `gridCoverage` frame retains the original unpadded canvas area;
it is absent when background placement already supplies that fact.
Completion recalculates against this coverage, avoiding cumulative expansion.
Left/top changes translate the grid origin, actor positions, Zone polygons,
and background/coverage together. Settings, alignment, enabling actor snapping, and
background/canvas resizing complete cells within their existing history action.
Grid changes can reduce prior margins; existing fit/snapping validation applies.
Background resizing changes coverage dimensions, retaining its top-left anchor
before any shared coordinate rebase. Deleting a
background retains its coverage; adding/replacing one establishes new coverage.
Grid geometry edits re-snap actors to nearby fitting anchors. Snapped Actor size
changes keep the top-left occupied cell in grid coordinates as their resize
pivot, including square, hex, projected, and warped grids. Growing and shrinking
reuse that cell instead of repeatedly rounding the current center; existing
occupancy and canvas-bound validation still apply. Only resized Actors are
repositioned; appearance edits do not change positions. A group
drag translates every selected actor by the same offset, then individually
snaps each actor when actor snapping is enabled. Each complete operation is one history action.

Square arrows move one neighboring anchor; hex arrows choose the adjacent
anchor closest to the requested screen direction. Ties use top-to-bottom then
left-to-right order. With Zone lock and actor snapping off, arrows nudge by 10 logical units (10/64 of fixed rendered grid spacing),
independent of the user-facing cell-size value. Background resizing does not change this distance.
Existing viewport
navigation remains available. Holding a movement key repeats unlocked actor steps
using native keyboard repeat, throttled to a global Combat preference of
200 ms by default (configurable from 50 to 2000 ms). The first keypress is
immediate; the OS supplies initial hold delay. The interval saves on blur or
Enter, survives reload/cross-tab changes, and resets with local preferences.
Each accepted step is independently validated
and undoable; repeat events received during pending validation are ignored
rather than queued after key release. Movement measurement and optional advisory budgets follow §18; terrain and actor pathfinding are not introduced. Cell Tracer pathfinding applies only to Zone drawing.

Background sizing, fitting, adding, and replacing change image coverage and
scale Zone polygons while retaining grid geometry and saved spatial coordinates.
Automatic completion recalculates against the new coverage; overflow follows
the Interface preference above. Resizing and any spatial unplacements commit
as one history action. Deleting Background retains grid and coordinates.
Cell-size settings preview the proposed map resize without changing EncounterState;
Cancel discards the draft. Alignment and detection preview measured grid geometry
against the current map. Apply resizes coverage by 64/measured-spacing and
transforms the fitted origin with the image, preserving rotation and normalized
warp coefficients. If the exact fit violates Zone layout limits or the chosen
actor overflow policy, reject Apply and keep the current encounter; do not
clamp alignment into an approximate fit. Saved actor coordinates remain fixed except for shared edge
rebasing and enabled actor snapping. The resulting map-scale value updates inversely.
Only Grid exposes visibility, settings, and alignment buttons in
its subtool groups on compact and desktop layouts.
Rule changes, geometry
edits, calibration, movement, and canvas changes are reversible history
mutations. Applicable semantic validation keeps existing OFF/ADVISORY/ASSISTED/
STRICT behavior; edge movement and automatic Zone layout validators require Zone lock.
Geometric fit and snapping invariants apply in every mode. Imports validate
these facts, supported old documents migrate to default Zone configuration,
and unsupported newer schemas are rejected without replacing valid data.

### Isometric presentation

Isometric grids use Square reservations: Large occupies four cells about a
vertex and xLarge nine about a center. Zone snapping, Cell Tracer, completed
boundary cells, and independent actor/Zone rules use the projected lattice.
Arrow movement chooses among four edge-sharing neighbors by screen-direction
alignment, breaking ties clockwise so all four neighbors remain reachable.

The final section of Settings > Canvas offers “Project tokens on isometric grids”, off by default.
This browser-local preference projects canvas artwork, backgrounds, and outlines
with nominal grid rotation, without local warp distortion. Names stay upright
and sit 16 canvas units below the projected token extent, accounting for size,
angle, and rotation;
logical footprints, hit areas, reservations, and EncounterState stay unchanged.
Library, Zoneless, and external transfer previews stay upright. Motion honors
reduced-motion preferences. Isometric Trim uses Square behavior.

## 18. Ruler, movement measurement, and grid styles

Locked ruler artifacts have an ID, optional display name (empty when unnamed), shape options (shape, optional cone angle, and optional `showDistance`/`highlightActors` flags), map-space control points, and nullable color/opacity overrides. `EncounterState.rulers` owns these artifacts as a normalized collection. Drafts and pending geometry edits remain session-only. Shared appearance preferences are local; nullable artifact overrides inherit those preferences.


- Grid Settings owns a positive whole-number distance per cell (default 5 feet), feet/meters/custom units (only feet and meters are concrete choices; standard distance names use abbreviations from mm through km and in/ft/yd/mi), independent of map sizing.
- Grid styles: Solid (default), Dashed, Dotted, Crosshair. Crosshair retains the outer quarter of each edge at both vertices, leaving its middle half empty. Preserve settings through alignment, detection, grid changes and resizing.
- Ruler immediately left of Select: Line, Circle, Rectangle, Cone, Path. Unfinished measurements are session-only and available read-only; locking and modifying saved artifacts require writer access. Ruler snapping always follows the Actors and Rulers grid snapping setting. Highlighting is derived from actor/ruler snapping, with no separate toggle. Canvas Settings chooses cell coverage: corners or center (default), center only, strictly more than half the cell area, corners plus the first forward cone cell, or corners plus all forward cells touching the cone origin. Corner thresholds are three on square/isometric grids and four on hex grids. Corner-or-center tests corners first. The cone-origin variants use the corner threshold without the center fallback; their extra cells exclude the source cell and must have actual cone overlap. The first-cell variant follows the centerline, resolving boundary ties with normal grid snapping. Other area shapes use the corner threshold in these two variants. Snapped Line rulers already form whole-cell routes, so their cell coverage is unchanged. Coverage and overlap fractions are evaluated in unprojected map geometry, independently of display warping and the rendered arc samples. Exactly half coverage is excluded from the majority mode. The local setting updates draft and saved-artifact highlights and optional cell-based area values without editing artifacts or adding encounter history.
- Shape subtools use icon buttons: Path (Waypoints), Circle (Radius), Cone, Rectangle, and Line (RectangleEllipsis rotated 90°), together in one button group. Remove the toolbar range field. The cone angle field uses an Angle icon, selects its text on click, and commits/blurs on Enter. Path is the default ruler subtool. Click to set shape endpoints or Path waypoints; only editable control points use dragging. Once at least two points are placed, clicking near any placed Path point locks the measurement; clicking after placing a non-Path shape locks that artifact. Clicking a placed control point locks, while dragging adjusts it. Space remains an alternative locking trigger, including for edited artifacts, using only placed points; it never adds the cursor preview as a waypoint. The live cursor point is white and placed points are solid. A contextual Lock icon supports touch. Ruler hides the touch multi-select control. Touch-capable screens also show an UndoDot control: tap to pick up the last placed point, hold to clear all draft points so the next tap places a new first point. Clearing an existing edit restores its saved artifact without history. Multiple locked artifacts remain through tool switches until deleted or cleared. Locked artifacts hide all visible point markers; editable point and angle handles appear only during creation/editing. Invisible context targets remain available. With the Ruler tool active, right-click a locked artifact for an Edit/Delete/Name/Color wheel with RulerDimensionLine and Lightbulb toggles around its compact ring; Lightbulb sits immediately clockwise of RulerDimensionLine (touch-hold on touch screens); editing Paths supports appending waypoints, and other shapes expose adjustable points. Left-clicks and short touch taps through saved artifacts place points for the active ruler, including snapped cell centers; saved artifacts do not block the live preview. While creating/editing, right-click anywhere on the ruler canvas—including editable points or another saved artifact—to pick up the last placed point, retaining earlier waypoints and the live cursor preview. Repeat to backtrack one point at a time. Removing the final draft point ends creation or restores the last saved version when editing. Escape cancels/restores the entire draft. Artifact context menus open only while the Ruler tool is active and no ruler draft/edit is active. Other tools do not hit-test saved rulers for context actions. Switching tools closes the radial menu and cancels any pending touch hold. Support explicit dimensions and angles. Locked artifacts persist in the encounter, including names and individual color/opacity overrides. Creating, deleting, clearing, renaming and changing appearance use encounter undo/redo. The artifact color dialog uses the same reusable spectrum/hex picker as Settings and Zone Properties, including screen eyedropper, ordered presets, and recent custom colors. It previews valid color and opacity edits on that ruler without changing EncounterState. Save commits one appearance action; Cancel, outside click, or Escape discards the preview. Its backdrop is transparent. Right-click dragging over the open dialog or its backdrop still pans the canvas when right-drag panning is enabled, without closing the dialog or discarding its preview. Only a left-click outside cancels. A drag handle centered in the header moves the dialog within the viewport, with arrow-key movement available on the handle. Selecting a palette color keeps the ruler palette expanded for further adjustments. Its palette toggle expands/collapses without closing the dialog, and Escape closes an open palette before cancelling the dialog. Cancel is at the lower left and Save at the lower right. Geometry edits remain temporary until a click or Space locks them again as one history step; Escape restores the last locked version. Initial unfinished shapes never enter history. Dragging a Circle center translates both control points together, preserving its radius and grab offset. Its body, handles, cells, and Actor highlights stay synchronized during translation, including in Flexible mode; dragging its radius point resizes it. All editable ruler point drags preserve their grab offset, coalesce pointer updates per frame, and render directly during manipulation, including in Flexible mode. Releasing or locking flushes the latest point position; cancelling discards pending updates.
- Measurements use unprojected grid space, rendered through rotation/projection/warp. Square circles start at vertices; snapped cones choose a source cell on the first click, then switch between its nearest side midpoint or corner according to the target trajectory. Side cones face outward from the source cell. There are no manual corner/side origin controls. Square cones default to 90°, hex cones to 60°. Unsnapped cones use the clicked origin. Placed/editable Cones also expose a derived drag handle at the left arc/straight-edge junction, relative to the facing direction. Dragging it toward or away from the arc midpoint symmetrically narrows or widens the angle in whole degrees within 1–180°, preserving origin, direction, range, and the existing two stored control points. It uses unprojected geometry and follows the same draft, re-lock, Escape, and undo/redo rules as other ruler edits. Shift+wheel in cone mode adjusts the angle; other wheel behavior is retained.
- Line is one cell wide. Choose the consistent repeating grid-step pattern that best reaches the target automatically; do not expose concrete orthogonal/diagonal pattern choices.
- Saved ruler context hit targets sit beneath Actors, while ruler graphics remain
  in the overlay. Actors under an AoE retain hover and dragging, including where
  ruler outlines, points, or captions overlap them. Context actions remain available
  on unobstructed ruler areas. Ruler captions cannot be text-selected.
- Line/Path distance follows ruler snapping. Calculated area is disabled by default and can be enabled in Canvas Settings (geometric when unsnapped, summed highlighted-cell area when snapped). Circle labels show radius, cone labels show length and degrees, rectangles show width × height, and line/path labels show distance. Keep the complete artifact label within canvas bounds, fitting long names as needed.
- Each saved ruler’s radial menu owns distance-text visibility (on by default) and overlapping-Actor glow (off by default for Path, on for all AoE shapes). These flags persist per artifact with undo/redo; omitted legacy flags resolve to those defaults. Hiding distance text retains an artifact’s name. Glow matches the ruler fill color and follows live ruler previews and Actor movement. Snapped overlap compares shared occupied/highlighted grid cells; continuous overlap tests the Actor footprint against the AoE. Path highlights only Actors touched by its route line, with no continuous corridor width; snapped Paths compare cells traversed by that line. Canvas Settings includes “Actor highlight intensity for ruler AoE overlap,” a local 0–100% slider defaulting to 50%; 0% hides glow. The setting synchronizes between tabs, resets with Canvas preferences, and adds no encounter history.
- Canvas Settings provides a ruler color picker, manual #RRGGBB/#RRGGBBAA entry and opacity. Default appearance follows the theme; preferences persist locally and synchronize between tabs. “Ruler feel” offers “Rigid and Snappy” (default) and “Flowy and Flexible”; the latter adds spring flow and bounce to draft manipulation using Motion, respecting reduced-motion preferences. Locked shapes have identical geometry and appearance in both modes.
- Separate Ruler and Select with a vertical divider. R activates Ruler; N opens a rename dialog for selected actors, zones, or the targeted ruler artifact (including its active editing draft). T activates Annotation and B activates Background. In Ruler, 1–5 select Path/Circle/Cone/Rectangle/Line, 9 toggles actor movement distance, and 0 clears rulers. Canvas hints follow the current state: click to begin or continue a measurement, click a placed ruler point or press Spacebar to lock only when a draft can be locked, and right-click saved artifacts for options while idle. Only touch-capable screens show touch-hold and other touch gesture hints.
- Combat diagonal policy: 1 (default), alternating 1–2, 2, or disabled. Hex retains six neighbors.
- Actor movement limits are optional and advisory in every validation mode. Unlocked movement previews routes; pressing Shift (or Space) during a drag fixes a pivot, preserving earlier segments and optimizing subsequent movement from the new pivot. No Add waypoint button is shown during a drag. The movement caption shows only distance and abbreviated units at the actor’s bottom right. A footwear icon in ruler subtools toggles that caption. Movement distance/range overlays end on pointer release, before a new actor position commits, so no new range boundary flashes on drop. The token itself retains its last pointer position during validation and settles from there to the accepted position, without replaying movement from its original position. Movement limits use a glow anchored at the drag origin with the available distance at drag start: whole reachable grid cells when snapped, a true radius when unsnapped. This is an advisory distance envelope, not obstacle pathfinding. Zone-locked movement has ruler only.
- Turn accounting defaults off and applies only to the active initiative actor. Reset per turn (default) or per round; the reset selector is enabled only while tracking is enabled. Count accepted drags/keyboard moves; exclude placement, removal, automatic packing and map changes. Carry alternating parity within accounting periods; otherwise restart per gesture.
- Movement and accounting commit atomically. Initiative changes, deletion and accounting changes preserve exact undo/redo. Changes to tracking/reset policy/costs/measurement units clear totals; limit edits retain totals.
