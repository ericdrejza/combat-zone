# Engagement Groups — Implementation Plan and Decision Record

## Purpose and status

Part 10 implements melee Engagement groups: normalized group membership, direct
manipulation flows, derived cluster layout, an explicit canvas render layer,
and history/validation coverage. The first implementation pass is present in
the working tree and Part 10 is recorded as complete in `ROADMAP_COMPLETE.md`.
This plan remains the living record for follow-up fixes and decisions; update it
when the Engagement behavior or design is changed.

The visual and multi-engagement follow-up was completed and verified on
2026-07-26:

1. The crossed-swords icon is visible with luminance-derived contrast.
2. A token drag that does not land on another token visibly returns to its
   settled position.
3. During a token drag, the token-side endpoint of every connector follows the
   dragged token.
4. Several Engagements in one zone use shared collision-aware layout and
   routing without overlapping tokens or actors.

The subsequent interaction follow-up was also completed and verified on
2026-07-26:

1. Multi-Engagement routing treats other Engagement tokens and accepted
   connectors as obstacles; regression coverage uses three Engagements with
   three actors each.
2. Hovering an existing Engagement participant or token uses the same 500ms
   intent delay as an unengaged actor. A quick drop does not join; matured
   intent shows the Engagement symbol and then joins or creates.
3. Token dragging uses MotionValues to avoid canvas re-renders and pointer
   lag. A non-merge same-zone drop slides home from its released point while
   connector origins follow the drag token.
4. Moving every participant to another zone before intent matures preserves
   the original group; matured intent instead groups the dragged actors and
   hovered actor as indicated.
5. Clicking a token selects all participants. A Lucide `Unlink2` Disengage
   action beside Engage removes only selected engaged actors.

## Product goal

An Engagement represents a transitive, actor-to-actor melee cluster in a
single zone. It is not a collection of pairwise links. The actor tokens form a
comfortable visual cluster around an Engagement token; that token and its
connectors make the relationship visible while remaining behind actors.

## Domain and ownership

- `Engagement` owns `participantIds`, `parentZoneId`, `layoutStrategy`, and
  `layoutOrientation`.
- Actors do not store a duplicate Engagement reference. Membership is derived
  from Engagement `participantIds`.
- An Engagement has at least two participants. It auto-dissolves as part of
  the action that leaves it with fewer than two members; it must never remain
  visible as a zero- or one-member group.
- A participant, token position, cluster position, and connector route are
  render/layout targets. They are not persisted EncounterState facts.
- The existing entity mutation module is
  `src/entities/engagement/engagementMutations.ts`; drag/drop composition is
  in `src/entities/engagement/engagementDrop.ts`.

## Settled visual design

- The Engagement token is 24px diameter (half a small actor), using
  `src/assets/images/crossed-swords.svg`.
- Earlier direction specified a transparent circle with zone-border-colored
  border and icon. The latest decision supersedes that appearance: its **fill
  is the parent Zone border color** and its swords icon is black or white based
  on the same background-luminance text-color function used elsewhere in the
  product. The token therefore needs a visible, contrast-correct icon rather
  than an SVG mask that can disappear.
- The Engagement layer renders after Edges and before Actors, so token and
  connectors are behind actor tokens. It is composed from
  `src/ui/canvas/engagements/EngagementLayer.tsx`.
- Token and connector colors are based on the parent Zone border color, except
  the latest contrast rule for the swords icon above.
- Engaged actors are close to their token, but never overlap it or each other.
  Participant spacing prefers 10px; dense layouts may reduce only to a 2px
  hard minimum unless an actor-to-actor branch joins the pair; branch anchors
  retain at least 10px of visible edge-to-edge span. Spacious FLEX zones first
  try 22px and 16px clearances, then rerun compactly if the wider cluster would
  reduce total zone capacity.
- In settled layouts, connectors avoid all actor footprints and other connector
  lines. Direct spokes may share only their own Engagement token endpoint.
  The bounded fallback is a same-style actor-to-connected-actor tree; its
  branches may meet at their connected participant endpoint. Every participant
  must receive either a token spoke or a branch from an already connected
  actor; an incomplete network is invalid rather than silently omitted.

## Layout and routing architecture

- Zone layout remains polygon-footprint based and derived; Engagement packing
  is an additional derived placement pass, not stored actor coordinates.
- FLEX membership has no numeric cap. Candidate generation starts with a
  single ring and adds compact concentric-ring arrangements as membership
  grows. If radial packing fails, all groups retry with boundary-first
  serpentine chain candidates. Exact polygon-center candidates and a small
  distance tolerance avoid false no-space results at valid boundaries.
- `src/core/layout/engagementPacking.ts` clusters participants using each
  Engagement's `FLEX` or `SEQUENTIAL` strategy and `LEFT_RIGHT` or
  `TOP_BOTTOM` orientation.
- `src/ui/canvas/engagements/engagementGeometry.ts` determines token placement
  and bounded connector routing. It must account for every actor footprint and
  previously accepted connector, including connectors belonging to other
  Engagements in the same zone.
- The token itself must be treated as a 12px-radius footprint by packing and
  collision checks, not merely placed at a participant centroid.
- With multiple Engagements in a nonsplit zone, all cluster participants,
  token footprints, and routes must be considered together. The order must be
  deterministic (collection `engagements.allIds`) so layout does not jitter.
- Engagements use token-owned participant regions: each participant center
  remains closer to its own token than another Engagement token. This prevents
  wrapping/nesting without reserving the circular reach of an elongated chain.
- Other Engagement tokens and accepted connectors are routing obstacles. A
  three-groups-of-three regression fixture guards against overlapping tokens
  and crossing or broken connectors in one shared zone.
- `getEngagementTokenPoint` must never settle on an actor or a different
  Engagement token. If a preferred placement fails, use bounded deterministic
  search with 10px preferred / 2px minimum clearance and a valid in-zone
  footprint; the geometry validator blocks an operation that cannot fit.
- Zone drag previews reuse the actor placement translation vector for
  Engagement participant points and the settled token before connector
  routing, so the complete Zone contents move rigidly without repacking.
- Connector geometry should be recomputed from the visual drag-token point
  while a token is dragged, then recomputed from settled derived layout when
  the drag ends.

## Split layouts

In `SPLIT_FLEX` and `SPLIT_SEQUENTIAL`:

- Unengaged actors remain in their usual faction sections.
- Engaged actors are excluded from faction sections.
- Each active Engagement gets its own isolated section, ordered by
  `engagements.allIds`, between hero and neutral sections.
- The section must contain the Engagement's participants and 24px token,
  preferring a line along the visible divider axis (vertical for LEFT_RIGHT,
  horizontal for TOP_BOTTOM). When the line cannot fit, larger groups reuse
  the section packer's wrapped geometry and reserve a valid token opening.
  Its derived `sectionPolygon` must be used consistently by rendering, hit
  testing, token placement, connector routing, drag recoil, section dividers,
  and validation.
- Multiple Engagement sections must have actual allocated geometry, rather
  than merely a cosmetic descriptor, and may not overlap other split sections.

## Interaction flows

### Toolbar action

- The non-toggle icon-only **Engage** action appears immediately to the right
  of Select, with `crossed-swords.svg` and an accessible label/tooltip.
- It groups selected actors independently per zone. A zone with fewer than two
  selected actors is a no-op.
- For each applicable zone, selected actors leave their previous Engagements;
  unselected prior members remain. Selected actors become one Engagement.
- Any resulting undersized old group dissolves. The full multi-zone action is
  one history-tracked mutation.

### Actor dragging

- Actor and Select tools support actor dragging and multi-selected actor
  dragging. All dragged actors participate, including cross-zone moves.
- Dragging an actor onto an unengaged actor waits 500ms before showing the
  engagement-intent symbol. Dropping after the delay creates an Engagement.
- Dropping before that delay puts all dragged actors in the target actor's
  zone without creating or joining the target Engagement. For an unengaged
  actor target, the dragged actors are unengaged unless the complete-group
  preservation rule below applies.
- Hovering an existing Engagement participant or token uses the same 500ms
  intent delay. A quick drop does not join; matured intent shows the symbol and
  joins the target group.
- Moving every participant of an Engagement to another zone before intent
  matures preserves its ID and membership while updating `parentZoneId` and
  each actor's zone. An actor moved to empty zone leaves an Engagement.
  A partial-group quick drop retains the prior behavior: moved actors leave
  their old Engagement and unengaged actors remain unengaged. Dropping onto
  the same Engagement is a no-op.
- While an engaged actor is dragged, its tether remains to the actor for the
  first 30px. After that distance, the actor-side endpoint recoils to the
  Engagement token center over approximately 150ms with Motion. Settled
  routing guarantees need not hold during that transient. Returning within
  the same 30px threshold reattaches the tether; dropping there returns the
  actor to its settled position and preserves Engagement membership without a
  history mutation.
- Matured actor or Engagement intent uses the Engage action's active toolbar
  color and shows a circular badge containing the crossed-swords icon. Moving
  beyond the tether without matured intent uses the Disengage action's active
  color.

### Engagement-token dragging

- Engagement tokens are draggable only in Actor and Select tools.
- Dragging one token onto another merges all participants into one group,
  subject to validation and recorded as a single history action.
- A token drag that does not land on a different Engagement token is not a
  domain mutation. It must animate/slide back to the original derived settled
  position, with no history entry.
- While token dragging, the token endpoint of each engagement connector tracks
  the drag position. Participant-side endpoints remain at actor positions; the
  line should not appear disconnected from the token.
- The preview uses MotionValues to avoid canvas-wide renders. A non-merge
  same-zone drop slides from its released point home, rather than jumping.
- A merge target token receives an outline in its Zone-name text color. The
  Engage toolbar action uses its active color while the merge target is under
  the dragged token.

### Selection and disengagement

- Clicking an Engagement token selects all participant actors.
- A non-toggle icon-only Lucide `Unlink2` **Disengage** action appears beside
  Engage. It enables when any selected actor is engaged and removes only the
  selected engaged actors. Resulting undersized groups auto-dissolve in the
  same history mutation and undo restores them.

## Validation and history invariants

- All Engagement create, join, merge, and move changes pass the shared
  geometry validation pipeline.
- No valid non-overlapping in-zone layout is a hard block in every validation
  mode (OFF, ADVISORY, ASSISTED, and STRICT). This is distinct from other
  mode-dependent validation messaging.
- A missing participant connector is also a hard block in every validation
  mode. Rendering and validation use the same core group-routing engine so
  connector completeness cannot drift between them.
- Every committed mutation uses Redux encounter history and serializable action
  records. A merge, Engage action, leave/split, and auto-dissolution cascade
  each must undo/redo as exact EncounterState snapshots.
- Local drag previews (including a rejected/abandoned token drag) do not write
  state or add history entries.

## Implementation map

- Entity state/actions: `src/entities/engagement/`
- Engagement packing / split section input:
  `src/core/layout/engagementPacking.ts` and
  `src/core/layout/engagementSplitLayout.ts`
- Render layer, geometry, hover, and token drag:
  `src/ui/canvas/engagements/`
- Canvas integration: `CanvasShell`, `CanvasWorkspace`, pointer/mouse-up
  handlers, and drag overlay under `src/ui/canvas/`
- Toolbar action: `src/ui/toolbar/EngageActionButton.tsx`
- Disengage toolbar action: `src/ui/toolbar/DisengageActionButton.tsx`
- Properties: `src/ui/panels/EngagementPropertiesPanel.tsx`
- Related tests: `tests/entities/engagement/`,
  `tests/ui/canvas/engagements/`, and layout/validation suites.

## Test and verification record

The initial implementation pass added coverage for mutation behavior, history,
hover intent, rendering/geometry, split layout, and validation. The last full
verification before the current follow-up report passed:

- `npm run test:agent -- --reporter=agent` — 48 files / 297 tests
- `npm run typecheck --if-present`
- `npm run build` (non-blocking Vite chunk-size warning only)
- `git diff --check`

The follow-up fixes added or revised focused tests for:

- contrast-visible crossed-swords token rendering (including dark/light zone
  border colors);
- abandoned token drag snapping back without a history commit;
- drag-time connector endpoints following the token;
- several Engagements in one ordinary zone, proving no actor/token footprint
  overlap and no invalid connector crossings;
- several Engagements in split layouts, proving their allocated sections,
  participant footprints, token footprints, and route endpoints remain valid.

The completed verification results are recorded below.

### Follow-up verification — 2026-07-26

Implemented and verified the follow-up repair work:

- The token now uses a zone-border-colored fill and a directly rendered
  crossed-swords image. The existing canvas luminance helper selects white
  swords on dark fills and black swords on light fills.
- Abandoned or validation-blocked token drags retain only local drag state,
  use Motion's `dragSnapToOrigin`, and clear that state after the return
  animation completes. No encounter-history action is committed.
- During a token drag, connector origins use the temporary drag point; the
  connector animation returns those endpoints to the derived settled token.
- Engagement packing now shares token geometry with rendering/hit-testing and
  validates both directions of token clearance: each token clears all actor
  footprints and accepted tokens, and later participants clear prior tokens.
  A bounded 129-position deterministic candidate search prevents multiple
  clusters in one zone from overlapping each other.

Focused tests cover dark/light token contrast, active/returning connector
endpoints, abandoned and validation-blocked drag returns, and multiple
Engagements in a shared FLEX zone. Final verification passed:

- `git diff --check`
- `npm run test:agent -- --reporter=agent` — 49 files / 301 tests
- `npm run typecheck -- --pretty false`
- `npm run build` — passed; existing Vite chunk-size warning remains

### Latest verification — 2026-07-26

Focused coverage now also verifies three simultaneous three-actor
Engagements, participant/token hover timing, whole-Engagement cross-zone moves
before and after intent, token click selection, selected-only disengagement
with auto-dissolution/history/undo, and MotionValue token previews.

- `git diff --check`
- `npm run test:agent -- --reporter=agent` — 50 files / 311 tests
- `npm run typecheck -- --pretty false`
- `npm run build` — passed; existing Vite chunk-size warning remains

### Drag affordance and split-layout verification — 2026-07-29

Token merge targets now use the Zone-name-color outline, toolbar actions mirror
engage/disengage drag intent once actor intent matures, and the actor intent
badge contains the crossed-swords icon. Token merges use gesture-authoritative
refs so start/move/end timing cannot lose the target. Spacious FLEX clusters
try wider clearances without sacrificing compact capacity, and split
Engagement sections align participants along the divider axis with chained
connector fallback. Visual split dividers use the same engagement-aware
section input as actor packing. Rendering and validation share connector
routing and reject incomplete participant networks in every validation mode.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 53 files / 338 tests

### Unbounded membership packing verification — 2026-07-29

FLEX candidate generation now adds concentric rings as membership grows, uses
precision-safe spacing, and always considers exact polygon centers before the
coarser whole-zone search grid. A 20-participant regression verifies complete
non-overlapping token, actor, and connector geometry in all validation modes.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 54 files / 343 tests

### Cluster isolation and Zone-drag verification — 2026-07-29

Unequal Engagements now reserve disjoint participant envelopes, including
when the smaller group gains actors. Zone drag previews translate settled
Engagement tokens, participant endpoints, and routed connector geometry by the
same vector already used for actor previews.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 54 files / 349 tests

### Visible branches and large split groups — 2026-07-29

Actor-to-actor fallback branches now require 10px of visible edge-to-edge span;
direct token spokes retain the 2px dense-layout minimum. Split Engagements
prefer the divider-axis line and fall back to wrapped section geometry when
larger membership cannot fit that line.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 54 files / 354 tests

### Multi-engagement chain fallback — 2026-07-29

Radial and multi-ring candidates remain preferred. When those candidates box
out a later Engagement, the packer retries the entire Zone with token-anchored
serpentine grids, considering boundary positions before the center. Cluster
isolation now uses token ownership rather than farthest-participant circles,
so elongated groups consume only the region they actually use. Regression
coverage grows neighboring 9- and 8-actor Engagements in a 500×360 Zone.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 54 files / 360 tests

### Authoritative derived token geometry — 2026-07-29

Actor placement worker/cache results now carry the packer-approved derived
token point for each Engagement participant. Rendering, hit-testing, and
Zone-move cache translation consume that same point instead of independently
recomputing a centroid that can collide with another group after a chain
fallback. Regression coverage includes neighboring groups of 8, 4, and 3
actors plus an explicit centroid-collision rendering fixture.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 55 files / 363 tests

### Curved-zone performance and boundary clearance — 2026-07-29

Engagement footprint containment now uses one center-in-polygon check plus the
exact shortest distance to the polygon boundary. This both enforces the 2px
actor/token edge clearance on circle and hexagon Zones and replaces five
costlier point-in-polygon samples per footprint. Whole-polygon candidate grids
discard centers outside curved polygons before generating layouts or routing
connectors. Dedicated performance coverage exercises 8/4/3 groups in circle
and hexagon Zones against the shared 100ms median / 150ms p95 budget.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 56 files / 368 tests

### Shape-aware no-overlap invariant — 2026-07-29

Engagement packing and routing now operate on full circle and axis-aligned
rectangle footprints. This closes diagonal rectangle/rectangle and
circle/rectangle intersections that center-radius checks could miss, applies
the same geometry to token search and connector obstacles, and keeps
independent 2px connector strokes separated. A final validator independently
audits every actor/actor, actor/token, and token/token pair. Negative and
positive audit fixtures cover every pair class, every hard-validation policy,
and moving several mixed-shape actors into a Zone with an existing Engagement.

- `git diff --check`
- `npm run typecheck`
- `npm run test:agent` — 59 files / 380 tests

## Decision log

| Decision | Source / date context | Status |
| --- | --- | --- |
| 24px token diameter | User follow-up answer 1 | Decided |
| Explicit Engagement layer sits between Zone/Edge rendering and Actors | User follow-up answer 2; final render order is after Edges, before Actors | Decided |
| Use crossed-swords for Engage action and token | User revised the initial fist request | Decided; supersedes fist token icon |
| Engage action is non-toggle, immediately right of Select, groups selected actors per zone | User follow-up answer 4 | Decided |
| Actor→actor engagement requires 500ms hover intent; early drop moves to target zone unengaged | User follow-ups 4 and 1 | Decided |
| Drag all selected actors, including cross-zone | User follow-up answer 5 | Decided |
| Same-group drop is a no-op | User follow-up answer 6 | Decided |
| Lines may share their own token endpoint | User follow-up answer 7 | Decided |
| Preferred/minimum cluster clearance is 10px / 2px | User follow-up answer 9 | Decided |
| Bounded best-effort direct routing, then safe tree fallback, never slow the app | User follow-up answer 9 | Decided |
| Collision/routing guarantees apply to settled layout only; actor tether recoils after 30px over ~150ms | User follow-up answer 10 | Decided |
| Split layouts allocate each Engagement its own section | Original request and user follow-up confirmation | Decided |
| Engagement token fill uses zone border color; swords use luminance-selected black/white | Latest follow-up repair request | Decided; supersedes transparent-fill presentation |
| Token drag with no merge reverts locally and connectors follow drag token | Latest follow-up repair request | Decided |
| Existing participant/token hover uses 500ms intent; quick drop does not join | User follow-up decision | Decided |
| Dragging every participant across zones preserves the original Engagement until intent matures | User follow-up decision | Decided |
| Clicking a token selects all participants | Latest interaction follow-up | Decided |
| Disengage removes only selected engaged actors | User follow-up decision | Decided |
| MotionValue token preview and released-point-to-home return | Latest interaction follow-up | Decided |
| Matured actor intent and token merge targets activate Engage; merge targets use Zone-name-color outlines | User follow-up on 2026-07-29 | Decided |
| Spacious FLEX clusters try 22px/16px clearance, with a compact whole-layout retry | User follow-up on 2026-07-29 | Decided |
| Split Engagement participants align along the visible divider axis and use connector chaining as needed | User follow-up on 2026-07-29 | Decided |
| Every Engagement participant must have a token or actor connector; incomplete networks are hard-blocked | User follow-up on 2026-07-29 | Decided |
| Engagement membership has no numeric cap; only valid Zone fit constrains it | User follow-up on 2026-07-29 | Decided |
| Engagement participant envelopes cannot nest or interleave, and fitting smaller groups remain growable | User follow-up on 2026-07-29 | Decided |
| Zone drag translates Engagement tokens and connectors by the actor preview vector | User follow-up on 2026-07-29 | Decided |
| Actor-to-actor connector anchors retain a 10px visible gap; direct spokes may use the 2px dense minimum | User follow-up on 2026-07-30 | Decided |
| Large split Engagements wrap inside their section when the preferred divider-axis line cannot fit | User follow-up on 2026-07-29 | Decided |
| Failed radial packing retries every Engagement with boundary-first serpentine chains; token ownership prevents nesting without circular over-reservation | User follow-up on 2026-07-29 | Decided |
| Engagement actors/tokens retain 2px from the exact polygon boundary; curved-zone searches prefilter invalid centers before layout generation | User follow-up on 2026-07-29 | Decided |
| Full rendered shapes—not center proxies—govern actor/token/line overlap, with an independent final hard audit after packing | User follow-up on 2026-07-29 | Decided |

## Open questions

None currently. New decisions that affect entity shape, history semantics,
validation policy, or visual interaction beyond this plan must be raised with
the user before implementation.
