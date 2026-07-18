# Motion Migration 2

This document records the canvas Motion migration without changing encounter
domain state, layout ownership, validation, or Redux history semantics.

## Planning

### Scope and decisions

- Motion owns direct manipulation of Actors, Zones, and Zone resize handles
  inside the SVG workspace.
- Native browser drag/drop remains in place for transfers originating in the
  Library or zoneless panel because Motion does not provide drop-zone behavior.
  Canvas-originated actor drops, including onto the zoneless panel, finish
  through the Motion gesture lifecycle.
- Static background SVG nodes remain native. Dynamic actor, zone, drafting,
  and selection geometry uses Motion SVG components.
- Right-click panning is not part of this migration because it is not present
  in the current canvas implementation.
- Automatic placement, reflow, undo/redo geometry changes, and rejected-drop
  returns use `{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }`.
  Active direct manipulation uses `{ duration: 0 }`.
- The operating-system reduced-motion preference makes automatic geometry
  transitions immediate while preserving direct manipulation.

### Official Motion findings

- Import React APIs from `motion/react`. A Motion component exists for each SVG
  intrinsic and can animate SVG attributes directly.
  <https://motion.dev/docs/react-svg-animation>
- SVG layout animation is unsupported. Do not apply `layout` or `layoutId` to
  SVG geometry; animate attributes such as `points`, `cx`, `cy`, and `r`.
  <https://motion.dev/docs/react-layout-animations#svg-layout-animations-are-broken>
- Motion drag callbacks provide `point`, `delta`, `offset`, and `velocity`.
  Momentum is disabled for deterministic editor commits.
  <https://motion.dev/docs/react-drag>
- `MotionConfig transformPagePoint={transformViewBoxPoint(svgRef)}` is the
  single coordinate conversion owner when the rendered SVG and viewBox sizes
  differ.
  <https://motion.dev/docs/react-svg-animation#drag-gesture>
- Motion has no official jsdom SVG gesture testing contract. Tests should
  assert authoritative state and declarative targets rather than depend on
  browser layout animation timing.

### Movement-state map

| Source | Render owner | Motion track | Policy |
| --- | --- | --- | --- |
| Actor layout `point` | actor `motion.g` | `x`, `y` | spring; immediate for reduced motion |
| Actor `incomingPoint` | actor `motion.g` | initial `x`, `y` to layout target | spring |
| Actor drag `current - start` | primary actor and drag overlay | Motion drag plus `x`, `y` targets | direct |
| Rejected/no-op actor drop | actor and overlay | return `x`, `y` | spring, then clear transient state |
| Actor radius/selection | `motion.rect`, `motion.circle`, `motion.image`, `motion.text` | radius-derived SVG attributes | owning actor policy |
| Zone polygon | `motion.polygon` | `points` | spring externally; direct while manipulating |
| Zone move | zone `motion.g` and contained actor targets | group drag and actor translation | direct; one commit on end |
| Zone resize | Motion resize handle and polygon tracks | `cx`, `cy`, `points` | direct; one commit on end |
| Zone label | `motion.text` | `x`, `y`, `fill` | owning zone policy |
| Target-zone pulse | `motion.polygon` | `strokeOpacity` keyframes | 1.2 seconds, linear, infinite |
| Draft/box selection | Motion SVG primitives | `points`, bounds, radii | direct |

### Event ownership

- Actor movement is initialized and updated by the Motion drag lifecycle. The
  old window and canvas mouse-move actor paths are removed.
- Zone selection still begins through the canvas entity hit-test; movement and
  resize updates come from Motion drag callbacks.
- The existing mouse-up mutation pipeline remains the single validation,
  history, and selection commit owner. Canvas mouse-up ignores a gesture once
  Motion has reported movement, so Motion drag-end commits exactly once.
- Cross-surface native drag/drop retains its existing handlers and normalized
  mutation helpers.

### TypeScript approach

- Motion intrinsics retain their native SVG prop types and add animation props.
- Dynamic SVG attributes are supplied through typed `animate` targets.
- Drag callbacks use Motion `PanInfo` coordinates and pointer-event-compatible
  event shapes; the migration removes the previous `as unknown` actor event
  casts.
- Transient drag phases remain local UI state. No persisted entity, Redux
  action, or JSON schema changes are introduced.

## Implementation

### Component structure

- `ActorLayer` owns placement and drag orchestration; `ActorVisual` owns
  radius-derived local geometry.
- `ZoneLayer` owns Motion polygon, label, target feedback, group drag, and
  resize handles.
- `CanvasOverlays` uses immediate Motion attribute tracks for draft and
  selection feedback.
- `canvasMotion` centralizes the approved spring, direct transition, and
  reduced-motion transition selection.

### Legacy paths removed

- Actor movement no longer installs a window `mousemove` listener or consumes
  canvas `mousemove`.
- Actor drag initialization is no longer repeated by both mouse-down and
  Motion drag-start.
- Native SVG SMIL is no longer used for the target-zone pulse.

### Gesture and commit flow

1. Motion begins an eligible entity gesture and captures viewBox-corrected
   coordinates.
2. Motion drag updates local transient state; render tracks follow directly
   without mutating encounter state.
3. Motion drag-end invokes the existing validation/history pipeline once.
4. Valid changes commit one Redux history entry. Invalid/no-op changes retain
   transient visuals until the approved spring returns them to authoritative
   geometry.
5. Automatic layout or history changes animate from the previous declarative
   target unless reduced motion is requested.

### Follow-up corrections

- Gesture state uses Motion's relative `offset` vector for zone movement,
  resize handles, and actor drop placement. Page-relative pointer positions
  are not mixed with SVG-local layout coordinates.
- Actors inside a moving zone receive the exact same relative vector as the
  zone group, preserving their visible relationship throughout the gesture.
- Dragged actors remain mounted beneath the drag overlay. Valid drops and
  actor-composition reflows therefore spring from the prior visible position
  to the new packed target instead of remounting at that target.
- Canvas entities disable text selection while they are being manipulated.
- Zone resize handles snap their Motion drag transform back to the origin
  after every commit, so the same selected-zone vertex remains aligned with
  its updated geometry and can be dragged repeatedly.
- Automatic actor layout changes use an explicit two-point Motion track from
  each mounted actor's prior rendered point to its new packed target. This
  includes reflows caused by changes to a Zone's actor composition.
- Drop origins are consumed only after the corresponding Actor has committed
  a visible frame at that point. Modal-preview drops, Zoneless-panel drops,
  and Zone-to-Zone moves therefore keep the moved Actor visible while both
  source and destination compositions animate to their new packed targets.
- An active Actor drag makes only the dragged Actor IDs direct-manipulation
  tracks. If the encounter commit renders before drag cleanup, neighboring
  Actors still treat source/destination repacking as automatic movement and
  spring from their prior packed points instead of accepting the new points
  with a zero-duration transition.
- The toolbar shows a far-right warning when the operating-system reduced
  motion preference would disable effects. The warning can enable an app
  override, stored in `localStorage` under
  `combat-zone.animation-effects-enabled`, so the choice survives app
  restarts without sending a client-only preference to the server.

### Verification notes

- The Motion test harness applies declarative targets synchronously and drives
  drag start/update/end callbacks without depending on jsdom SVG measurement.
- `npm run typecheck` passes.
- `npm run test:agent` passes all 38 files and 234 tests, including actor/zone
  undo and redo, validation, collision rejection, external drops, snap-back,
  and selection behavior.
- `npm run build` succeeds. Vite continues to report the existing browser
  externalization warnings for `path` imports in upload/drop helpers; they are
  unrelated to this migration.
