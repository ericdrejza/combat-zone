# Canvas Background and Navigation Plan

## Purpose and delivery gate

This plan repairs the responsive-SVG drag-coordinate desynchronization first.
It then adds a resizable encounter canvas/background and viewport navigation.
The first delivery is deliberately isolated: after its automated verification
and production build pass, stop and wait for the user's real-browser manual
test confirmation. Do not begin background sizing, zoom, scrolling, or panning
until that confirmation is explicit.

Do not update `documentation/DESIGN.md`, `documentation/ACCEPTANCE.md`, or
`documentation/ROADMAP.md` during this planning/documentation work. Update
them only after the relevant implementation has passed its completion checks.

## Implementation status

- Stage 1 was completed and passed its required manual browser gate.
- Stages 2 and 3, including the viewport and canvas-resize refinements, are
  implemented and verified.
- Verification completed: 77 files / 484 tests pass; typecheck and the
  production build pass.

## Settled model

- Persist `EncounterState.canvasSize` as `{ width, height }`, defaulting to
  `{ width: 960, height: 640 }`. All canvas bounds, SVG viewBoxes, geometry
  validation, overlays, and luminance canvases derive from this authoritative
  size rather than fixed constants.
- Persist intrinsic width and height with a background image when it is read.
  The intrinsic dimensions, not browser layout dimensions, drive sizing
  commands and background geometry.
- Do **not** persist a background `sizingMode`. Fit choices are one-time
  commands. Their selected radio state is derived from the current canvas and
  intrinsic-image dimensions, never stored as a competing source of truth. A
  session-local preferred command disambiguates mathematically identical fit
  results for the radio UI only; it is never persisted.
- Fit commands are one-time canvas-size mutations computed from the visible
  scroll viewport at 100% zoom:
  - `fit`: `scale = min(viewportWidth / imageWidth, viewportHeight /
    imageHeight)` so the whole image fits and one axis equals the viewport.
  - `fit width`: background/canvas width equals the viewport width and height
    follows the intrinsic aspect ratio; vertical overflow is allowed.
  - `fit height`: background/canvas height equals the viewport height and width
    follows the intrinsic aspect ratio; horizontal overflow is allowed.
  The background fills these resulting logical canvas bounds without crop or
  distortion. No persistent display-mode field is added.
- Canvas shrink and expand change both dimensions by 10% while preserving the
  current canvas aspect ratio. Shrinking clamps to the nearest larger scale at
  which every Zone and derived actor layout remains valid; expansion has no
  arbitrary maximum.
- A canvas-size mutation uniformly scales all persisted Zone polygon points
  from the top-left origin `(0, 0)`. Actors, Engagements, and Edges are
  derived: their layouts/routes recalculate from the transformed Zones, and no
  actor, Engagement, or Edge coordinates are persisted.
- Adding or replacing a background computes its default fitted canvas size.
  With existing Zones, use the smaller new-width/old-width and
  new-height/old-height ratio for initial uniform top-left scaling so Zone
  shapes are not distorted. If that result is unsafe, enlarge it to the
  nearest valid scale; a clamped result is custom and has no selected fit
  radio. Deleting a background keeps canvas bounds unchanged.
- A canvas-size mutation preserves the current zoom and the logical canvas
  point centered in the viewport.
- Viewport state is session-only and remains outside encounter Redux history:
  zoom, scroll position, and pan interaction state do not create history
  entries. A future loaded encounter starts with zoom-to-fit.
- Zoom ranges from 20% through 400% in 10-point steps. Each increment/decrement
  keeps the viewport center anchored to the same canvas point. A separate
  one-time zoom-to-fit command fits the full canvas in the available viewport.
- Right-drag panning is enabled by default. The canvas receives focus and
  arrow keys pan the scrollable viewport while it is focused. Existing
  right-click cancellation behavior remains available when the gesture is not
  being used to pan.

## Completed viewport and canvas-resize refinements

The following refinements are implemented and covered by the completed
verification recorded above.

- The viewport remains scrollable in both axes, but native scrollbar chrome is
  visually hidden; scrolling, keyboard navigation, wheel input, and panning
  remain available.
- A canvas-size mutation preserves the current zoom rather than resetting it
  to 100%. It also preserves the logical canvas point centered in the viewport:
  capture the centered point before the mutation, map it through the same
  top-left canvas resize transform, then restore scroll position so that mapped
  point is centered after layout.
- Fit commands operate relative to the currently zoomed viewport rather than
  assuming an unzoomed viewport. Their calculations use the available viewport
  dimensions and current zoom context.
- Zoom/navigation controls are available even when no background image exists.
- Add an explicit reset-zoom control and a visible current-zoom percentage in
  addition to zoom out, zoom in, and zoom-to-fit.
- At exactly 100% zoom, retain a fixed perceptual anchor so the canvas does
  not visually jump as fit/resize calculations or viewport dimensions update.

## Stage 1 — shared coordinate conversion

### Implementation

1. Create a focused canvas coordinate helper under `src/ui/canvas/` as the
   only owner of rendered-viewBox bounds, client/page point conversion, and
   browser-offset to SVG-offset conversion.
2. Replace the independent `toSvgPoint()` math and Motion conversion setup
   with this shared contract. It must account for all responsive letterboxing
   margins and must never combine browser-pixel offsets with SVG-domain points.
3. Apply the helper consistently to native drops, drawing, click/box
   selection, actor drag, Zone drag, and Zone resize-handle drag.
4. Keep the existing `960 × 640` encounter canvas, validation rules, history
   behavior, and rendering ownership unchanged in this stage.
5. Preserve one persistent actor node throughout an actor drop. For a
   cross-Zone drop, hold that node at the cursor drop point while the
   authoritative layout is pending, then make one Motion transition to the
   calculated placement. For a same-Zone drop, make one Motion transition from
   the drop point back to the frozen original placement. Do not remount the
   actor or allow a bounce through an intermediate position.

### Verification

Add focused tests with mismatched SVG client/viewBox aspect ratios and large
horizontal and vertical workspace margins. Verify:

- point conversion at matching and mismatched responsive sizes;
- Zone drag commits the displayed SVG-domain vector;
- actor and resize-handle drags use identical scale/offset behavior;
- native drop placement shares the conversion; and
- worker-pending cross-Zone handoff holds one persistent actor at the drop
  point before one transition to its calculated placement;
- a cross-Zone drop followed by a same-Zone drop transitions from the latter
  drop point back to the frozen original placement without remounting or
  bouncing; and
- existing containment/validation behavior remains intact.

Run affected tests, `npm run test:agent`, `npm run typecheck`, and the
production build.

### Required manual-test gate

Stop after the Stage 1 checks. The user must resize the browser/application to
produce excess workspace margins, drag Zones, Actors, and resize handles at
multiple canvas sizes, and confirm that the cursor and displayed geometry stay
synchronized through release. Only explicit user confirmation authorizes the
remaining stages. A reported failure resumes Stage 1 diagnosis only.

### Manual-test follow-up

- Cursor/entity drag speed passed the first browser check.
- The same check exposed an actor-drop handoff artifact: the hidden source
  and visible overlay could briefly disagree, while live placement revisions
  could restart a same-zone return track. Stage 1 therefore renders each actor
  exactly once, freezes drag-origin points, and moves that same SVG actor from
  pickup through the cursor-aligned drop point to one settled layout target.
- A light dashed outline marks the current logical canvas boundary so users
  can distinguish drawable space from responsive workspace margins.

## Stage 2 — persisted canvas bounds and background commands

### State, history, and geometry

1. Extend `EncounterState` creation/types/tests with persisted `canvasSize`.
   Replace fixed canvas-size consumers with selectors/helpers that receive the
   encounter's authoritative dimensions.
2. Extend the background-image data contract and image-reading helpers with
   intrinsic dimensions. Preserve these fields through library use, native
   drop, background replacement, history, and eventual export/import.
3. Add a focused background-sizing engine that computes fit, fit-width, and
   fit-height canvas dimensions from viewport and intrinsic image dimensions.
   Reuse it for the SVG image and canvas luminance sampling so visual pixels
   and contrast calculations cannot diverge.
4. Add focused canvas-size mutation helpers. Each fit/shrink/expand command
   creates one candidate encounter snapshot, applies top-left uniform Zone
   scaling, validates it, then commits one Redux history action when valid.
   Safe clamping occurs before scaling and validation.
5. For background replacement, calculate the new image's fitted bounds, scale
   Zones uniformly with the smaller dimension ratio, and safely enlarge the
   result if necessary. Background deletion removes only the image and retains
   those bounds.

### Background toolbar controls

The Background Tool exposes the finalized fit command/radio group and 10%
shrink/expand controls. The radio's displayed state is computed from current
canvas and intrinsic-image dimensions; it is not a persisted field. Retain the
existing add, replace, and delete controls and their accessible labels.

Use `Minimize2`, `MoveHorizontal`, and `MoveVertical` for the Background radio
group, followed by `Shrink` and `Expand` action buttons titled exactly
“Shrink” and “Expand”. The global viewport controls include `Scan`, `ZoomOut`,
`ZoomIn`, an explicit reset-zoom control, a visible percentage, and
`MousePointer2` at the toolbar right.

### Verification

Add tests for:

- default `canvasSize` and intrinsic background dimensions;
- fit, fit-width, and fit-height document-size formulas;
- matching luminance geometry;
- each one-time fit command and dimensions-derived radio state;
- 10% shrink/expand aspect-ratio preservation, clamping, and top-left Zone
  scaling;
- derived actor/Engagement layout and Edge route recomputation without stored
  derived coordinates;
- replacement fitting the new document with smaller-ratio Zone scaling and
  deletion retaining bounds;
- exact snapshot undo/redo and log actions for every canvas/background command;
- Strict blocking and Advisory permissiveness where a candidate canvas resize
  violates existing validation rules.

## Stage 3 — scrollable viewport, zoom, and pan

### Component boundaries

- Add a focused `CanvasZoomControls` toolbar-right component and a focused
  viewport/navigation hook. Keep `Toolbar.tsx` and `CanvasShell.tsx` as
  composition/orchestration components.
- Wrap the SVG in a two-axis scroll viewport. The SVG, overlays, native drops,
  and zoneless panel must remain coordinate-aligned at all zoom levels.
- Keep viewport state local/session-only. No zoom, scroll, or pan update may
  mutate `EncounterState` or add Redux history.

### Interaction contract

1. Render the settled right-side Lucide controls with `Scan` (one-time
   zoom-to-fit), `ZoomOut`, `ZoomIn`, an explicit reset-zoom control, a visible
   percentage, and `MousePointer2` (right-drag pan toggle/indicator). Render
   them even with no background image, and give each control an accessible name
   and concise tooltip.
2. Clamp zoom to 20–400%, change it in 10% increments, and recenter scrolling
   so each zoom step preserves the currently viewed canvas center.
3. Preserve zoom and the viewport's centered logical canvas point after any
   canvas-size mutation. Apply zoom-to-fit once when a future encounter load
   presents its canvas, calculate fit against the current zoomed viewport, and
   preserve the fixed perceptual anchor at exactly 100% zoom.
4. Enable right-drag panning by default. During an actual pan, update the
   scroll viewport and suppress the context menu for that gesture only.
5. Make the canvas focusable. While it has focus, arrow keys pan the scroll
   viewport; otherwise they retain normal page/control behavior.

### Verification

Add tests for:

- controls available without a background, accessibility names/tooltips, reset
  zoom, visible percentage, zoom bounds, 10-point stepping, and zoom-to-fit;
- center-preserving zoom scroll math and two-axis scroll reachability;
- hidden native scrollbar chrome while wheel, keyboard, and pan scrolling
  remain usable;
- preservation of zoom and the mapped centered logical canvas point after a
  canvas-size mutation, including the fixed 100% perceptual anchor and fit
  calculations relative to the current zoomed viewport;
- default-enabled and toggleable right-drag panning, including context-menu
  behavior when no pan occurs;
- canvas-focused arrow-key panning;
- alignment of drawing, dragging, resizing, selection, overlays, and native
  drops under zoom/scroll;
- no viewport history entries; and
- future-load initialization selecting zoom-to-fit.

## Completion

After explicit Stage 1 manual approval and successful implementation of the
remaining stages, run `npm run test:agent`, `npm run typecheck`, and the
production build. Only then update the relevant design, acceptance, and
roadmap records and mark related work complete.
