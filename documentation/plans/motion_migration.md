# Motion SVG Migration

This document records the intended Motion migration for the encounter canvas.
It is a repeatable implementation guide, not a change to product behavior.
`documentation/DESIGN.md`, `documentation/ARCHITECTURE.md`, and the repository
`AGENTS.md` remain authoritative.

## Scope and preservation decisions

- Migrate only SVG nodes whose geometry or existing animation changes over
  time. Static SVG nodes remain native React SVG elements.
- Preserve the rendered appearance, hit targets, render-layer order, selection
  behavior, drag semantics, and Redux/history boundaries.
- Animate geometry declaratively through Motion targets. Examples include
  `x`, `y`, `cx`, `cy`, `r`, `width`, `height`, `points`, and the existing zone
  target pulse.
- Never apply `layout` or `layoutId` to SVG geometry or other SVG nodes. Motion
  does not support SVG layout animation. If HTML layout animation is later
  required, place it on an HTML `motion.div` outside the SVG tree.
- Direct manipulation must not lag behind the pointer. Dragging, resizing,
  drafting, and box selection use `transition={{ duration: 0 }}`.
- Preserve the actor placement spring exactly: `{ type: "spring", stiffness:
  420, damping: 30, mass: 0.55 }` when movement is not direct manipulation.
- Preserve the zone actor-target pulse exactly: stroke opacity keyframes
  `0.10 -> 1 -> 0.25`, duration `1.2s`, repeating indefinitely.
- Use `initial={false}` for migrated geometry so loading and ordinary mounting
  do not introduce new animations. The only exception is the existing actor
  `incomingPoint` transition.
- Do not add decorative hover, tap, enter, exit, or path-morph effects as part
  of this migration.

## Official Motion guidance

- [Motion for React](https://motion.dev/docs/react): import `motion` from
  `motion/react`; changing an `animate` target automatically transitions to the
  new value.
- [Motion component](https://motion.dev/docs/react-motion-component): Motion
  provides intrinsic components for HTML and SVG tags and retains their normal
  props and behavior. `initial={false}` renders the `animate` target without an
  enter animation.
- [SVG animation](https://motion.dev/docs/react-svg-animation): SVG attributes
  can be animated directly (`animate={{ cx: 50 }}`). Motion provides every SVG
  intrinsic, supports `d`, `viewBox`, and path drawing, and accepts
  `MotionValue`s on the appropriate attribute.
- [SVG attribute shorthands](https://motion.dev/docs/react-svg-animation#x-y-scale-attributes):
  Motion `x`, `y`, and `scale` normally produce transforms. Use `attrX`,
  `attrY`, and `attrScale` only when the actual SVG attributes named `x`, `y`,
  or `scale` are intended. Native geometry names such as `cx`, `cy`, and `r`
  can be targeted directly.
- [SVG drag gesture](https://motion.dev/docs/react-svg-animation#drag-gesture):
  a scaled SVG `viewBox` requires `MotionConfig` with
  `transformPagePoint={transformViewBoxPoint(svgRef)}` so pointer coordinates
  and SVG coordinates agree.
- [Animation and variants](https://motion.dev/docs/react-animation): variants
  are named targets that can propagate through Motion descendants. Dynamic
  variants receive data through `custom`. Direct `animate` objects are simpler
  for independent geometry whose destination is already computed.
- [Transitions](https://motion.dev/docs/react-transitions): transitions may be
  component-wide, embedded in a target/variant, or property-specific. Explicit
  transitions avoid Motion's property-dependent defaults.
- [Gestures](https://motion.dev/docs/react-gestures): Motion gestures include
  hover, tap, focus, pan, and drag. A native child can suppress a parent Motion
  gesture in `onPointerDownCapture`; a Motion child can disable tap propagation
  with `propagate={{ tap: false }}`.
- [Layout animation troubleshooting](https://motion.dev/docs/react-layout-animations#svg-layout-animations-are-broken):
  SVG has no supported Motion layout system; animate attributes directly.

The installed package at the start of this work is Motion `12.42.2`.

## Current architecture and migration status

`CanvasShell` owns orchestration and delegates canvas presentation to
`CanvasWorkspace`. `CanvasWorkspace` composes the existing render layers in
their defined order. It already wraps the workspace in `MotionConfig` with
`transformViewBoxPoint(canvasRef)`, which is required for accurate SVG drag
coordinates under the `viewBox`.

At the start of this migration:

- `CanvasWorkspace` renders `motion.svg` and keeps it as the Motion-enabled
  canvas root. `MotionConfig` supplies coordinate conversion to its draggable
  descendants.
- `ActorLayer` is partially migrated. Each actor uses `motion.g`, Motion drag,
  the preserved placement spring, zero-duration direct manipulation, and the
  `incomingPoint` exception. Actor child geometry remains native.
- `ZoneLayer` is native SVG. Its displayed polygons, name position, and resize
  handles receive changing geometry. The actor-target outline uses a native
  SVG `<animate>` pulse that must be translated to Motion without visual change.
- `CanvasOverlays` is native SVG. Draft and selection geometry follows live
  pointer state and therefore must use zero-duration Motion targets.
- `CanvasDragOverlay` is a native, pointer-transparent SVG that reuses
  `ActorLayer`. Its actor movement is direct manipulation and must remain
  immediate.
- Actor input uses mouse-down once for selection/domain drag initialization.
  Motion drag-start only transfers coordinate ownership by setting
  `usesMotion`; it does not repeat selection or reinitialize the drag.

## State-to-track and variant map

“Native” below means the value may still update through React, but it is not a
Motion animation track. Use a variant only for a named visual state; computed
coordinates should normally be direct `animate` targets.

| Area / source state | Node | Motion target | Initial / transition | Notes |
| --- | --- | --- | --- | --- |
| Canvas constants and background document | root `svg`, background `rect`/`image`, render-layer `g` | Native | None | Static structure stays native. Keep `MotionConfig` around the SVG tree. |
| Actor placement `point` | actor `motion.g` | `{ x: renderedPoint.x, y: renderedPoint.y }` | `initial={false}`; preserved actor spring | Continue using a group transform so all actor children move together. |
| Actor `incomingPoint` | actor `motion.g` | Same destination as placement | Initial `{ x: incomingPoint.x, y: incomingPoint.y }`; preserved spring | The sole allowed non-false initial geometry target. |
| `actorDrag` gesture | transparent nested `motion.g` handle | Motion drag owns the handle offset while the anchored actor target remains unchanged | `dragElastic={0}`, `dragMomentum={false}`, `dragSnapToOrigin` | Mouse-down initializes once; Motion drag-start only marks `usesMotion`, then Motion owns update/end. The handle is not a visible actor instance. |
| `actorDrag` visible feedback | pointer-transparent `CanvasDragOverlay` outer actor `motion.g` plus inner visual `motion.g` | Outer group tracks the canvas cursor; inner group animates the inverse initial grab offset to zero | Outer `duration: 0`; inner 140ms ease-out tween | The anchored `ActorLayer` visual is absent for dragged actors, so the overlay is the only visible instance. The inverse offset keeps the first overlay frame at the actor's original center, then slides that center onto the cursor. |
| Same-zone actor return | `CanvasDragOverlay` outer actor `motion.g` | Original anchored placement | 200ms ease-out tween | Keep the overlay mounted and the anchored visual hidden until the return animation completes, then clear transient drag state. |
| `zoneActorTranslation` | actor `motion.g` | Computed translated `{ x, y }` | `duration: 0` | Direct manipulation must follow the pointer exactly. |
| Actor `radius` / derived `innerRadius` | local shape, clip shape, image, selected/faction outline, image-name offset | Track only attributes that actually change: circle `r`; rect/image `x`, `y`, `width`, `height`; text `dy` | `initial={false}`; use the same direct/spring policy as the owning placement update | Convert only nodes with changing geometry. Fill, class, dash pattern, labels, and clip IDs stay ordinary props. Shape changes remain conditional React rendering, not path morphing. |
| Actor selection and faction display | base/outline nodes | Motion-managed `strokeWidth` and `strokeDasharray` where present; native `stroke` and conditional visibility | `initial={false}`; geometry follows the owning actor transition | Conditional mounting must not add an enter/exit effect. |
| Zone `getDisplayedPolygon(zone)` | primary zone polygon | `{ points: polygonToPoints(polygon) }` | `initial={false}`; `duration: 0` during drag/resize | The displayed polygon already incorporates optimistic/direct manipulation geometry. If a later non-direct polygon transition is desired, it requires an explicit product decision. |
| Same displayed polygon + zone selection | selected outline polygon | Same `points` target | Same as primary polygon | Selection controls conditional mounting only; no enter/exit effect. |
| `actorTargetZoneId` + displayed polygon | target outline polygon | `points` plus `strokeOpacity: [0.10, 1, 0.25]` | `initial={false}` for geometry; pulse `{ duration: 1.2, repeat: Infinity, type: "tween" }` | Replaces the existing SVG `<animate>`. A named `targeted` variant is acceptable, but a direct keyframe target is sufficient. Keep dash `20 15` native. |
| `getZoneNamePosition(zone, polygon)` | zone name text | `{ attrX: namePosition.x, attrY: namePosition.y }` | `initial={false}`; `duration: 0` during direct manipulation | `x`/`y` must be SVG attributes, not Motion transforms. Anchor and dominant baseline remain native props. |
| `getZoneResizeHandles(zone, polygon)` | resize handle circle | `{ cx: point.x, cy: point.y }` | `initial={false}`; `duration: 0` | `r=6` is static and remains native. Preserve the mouse/pointer-down ownership used to initiate resize. |
| `zoneDraftPoints` | draft polyline | `{ points: polygonToPoints(zoneDraftPoints) }` | `initial={false}`; `duration: 0` | Live tool feedback. Dash and color stay native. |
| Each `zoneDraftPoints` point | draft marker circle | `{ cx: point.x, cy: point.y }` | `initial={false}`; `duration: 0` | Marker radius is static for its role (`6` first, otherwise `4`). Stable React keys must not depend only on changing coordinates if identity is available. |
| `shapeDraft.start/current/shape` | shape draft polygon | `{ points: polygonToPoints(createShapePolygon(...)) }` | `initial={false}`; `duration: 0` | Shape mode remains domain/tool state, not a Motion variant. |
| `boxSelection` bounds | box-selection rect | `{ attrX, attrY, width, height }` | `initial={false}`; `duration: 0` | Use `attrX`/`attrY` to update SVG attributes; compute bounds once per render before constructing the target. |

### Variant policy

Do not manufacture variants for raw coordinate values. The useful semantic
states in this canvas are:

- `resting` / `directManipulation` for choosing transition policy; these can
  remain a simple conditional transition instead of variants.
- `targeted` for the existing repeating zone pulse; a variant is optional if
  it improves readability.

Selection, tool activation, faction visibility, and shape choice currently
change rendering or ordinary visual props. They must not gain animation merely
because Motion is present.

## Event ownership

Each user action must have one lifecycle owner and one Redux/history commit.

- Canvas click, double-click, context menu, external drag/drop, and tool pointer
  handlers remain ordinary React events on the canvas unless Motion directly
  replaces that exact workflow.
- Actor mouse-down initializes selection and transient domain drag state once.
  Motion `onDragStart` only marks the drag as Motion-owned; it must not repeat
  initialization. Motion `onDrag` and `onDragEnd` then own updates and
  finalization. Before Motion starts (including test/native fallback paths),
  window mousemove and mouseup own updates and finalization instead. Keep
  `dragMomentum={false}` and `dragElastic={0}`.
- Motion `info.point` is a transformed page/pointer coordinate and must not be
  sent directly to canvas zone hit-testing. Convert the mouse-down pointer to
  canvas coordinates and add Motion's `info.offset`; this gives the cursor
  position that the overlay actor center tracks. Use that derived center for
  transient drag state, destination-zone lookup, and optimistic placement.
- Keep the layout-positioned actor group separate from its transparent Motion
  drag handle. While `actorDrag` is active, hide that group's actor geometry
  and render every dragged actor only in `CanvasDragOverlay`. This prevents
  duplicate tokens. A same-zone drop enters a transient returning state so the
  overlay animates to the unchanged anchor before the main visual reappears.
- Zone polygon selection/drag initiation and resize-handle initiation remain
  their established pointer/mouse workflows unless intentionally migrated as
  one complete lifecycle. Converting a node to `motion.*` does not require
  converting its event API.
- Do not attach native `onDrag*` and Motion `onDrag*` handlers to the same
  element. The names overlap but the semantics and callback signatures differ.
- Preserve propagation guards and canvas hit-testing. Use capture-phase pointer
  suppression when a child must prevent a parent Motion gesture.
- Animation completion must not dispatch duplicate mutations. Motion is a
  presentation layer; authoritative encounter changes remain in the existing
  interaction and Redux paths.

## TypeScript and prop forwarding

- Prefer direct intrinsics (`motion.circle`, `motion.polygon`, `motion.rect`,
  `motion.text`, `motion.g`). They infer the correct SVG element/ref and accept
  normal SVG attributes plus Motion props.
- Motion `12.42.2` exports `SVGMotionProps<T>` from `motion/react`. Use
  `SVGMotionProps<SVGCircleElement>` or
  `React.ComponentProps<typeof motion.circle>` only when a component is meant
  to expose Motion props.
- Preserve an existing `React.SVGProps<T>` public contract when callers should
  continue to supply only normal SVG props; those props can be spread onto the
  corresponding Motion intrinsic.
- Do not intersect `React.SVGProps<T>` with `MotionProps`. Conflicting names
  include `onDrag`, `onDragStart`, `onDragEnd`, `style`, and `transform`.
  `SVGMotionProps<T>` deliberately removes conflicting native attributes before
  adding Motion's definitions.
- Avoid `as unknown as` event casts. Adapt the local callback type to the
  actual Motion callback signature or introduce a small, explicitly typed
  adapter at the interaction boundary.
- If `motion.create` becomes necessary, the wrapped component must forward its
  ref to the animated SVG/DOM node. Create it at module scope, not during
  render. Motion props are filtered from the wrapped component by default;
  enable `forwardMotionProps` only when that component intentionally consumes
  them.
- Spread caller props before locally owned Motion targets and handlers so a
  caller cannot accidentally override the migration's animation or commit
  lifecycle. Merge intentionally when extension is required.

## Ordered redo checklist

1. Read the authoritative design, architecture, acceptance criteria, this
   document, and the initial migration instruction.
2. Record the installed Motion version and run the baseline typecheck and
   canvas tests before editing.
3. Inventory SVG nodes under `src/ui/canvas`; mark each as static, changing
   geometry, existing animation, or interaction owner.
4. Confirm `MotionConfig` and `transformViewBoxPoint(canvasRef)` surround every
   Motion drag node rendered in the scaled workspace.
5. Keep static root/background/layer nodes native. Convert only the changing
   geometry listed in the map.
6. Complete actor tracks while preserving `incomingPoint`, the exact spring,
   zero-duration direct manipulation, drag overlay behavior, clip geometry,
   selection appearance, and faction outlines.
7. Convert zone polygon, label-position, and resize-handle geometry. Replace
   only the existing target-zone SVG pulse with the equivalent Motion
   keyframes.
8. Convert live overlay geometry with `initial={false}` and duration zero.
9. Audit event ownership. Remove duplicate lifecycle handlers only after
   proving which path owns selection, drag updates, and the single final
   mutation.
10. Remove unnecessary casts and verify props/refs against Motion's intrinsic
    TypeScript types.
11. Run formatting/linting if configured, typecheck, and focused tests; then
    run the full required agent test command.
12. Compare behavior visually and through DOM assertions. Update roadmap or
    acceptance checkboxes only when their existing completion rules are met.

## Verification strategy

Automated verification must cover both presentation and unchanged domain
semantics:

- Run the repository typecheck/build command and ensure no Motion prop or event
  casts hide errors.
- Run focused canvas tests with Vitest's agent reporter, then
  `npm run test:agent` as required by repository instructions.
- Assert static nodes remain native and dynamic nodes expose the intended
  Motion targets without `layout` or `layoutId`.
- Assert actors render at calculated placements, animate from `incomingPoint`
  only when applicable, use the exact spring outside direct manipulation, and
  use duration zero while actor/zone dragging.
- Assert Motion drag emits one start/update/end sequence and results in one
  encounter mutation. Verify selection clicks do not accidentally start or
  commit a drag.
- Assert zone drag and resize geometry, label positions, selected outlines, and
  resize handles stay synchronized with the displayed polygon.
- Assert target-zone pulse values, duration, and infinite repeat match the
  pre-migration animation.
- Assert draft polygon/polyline/markers and box selection follow pointer state
  immediately with no mount animation.
- Verify scaled/resized canvas drag coordinates through the existing
  `transformViewBoxPoint` setup.
- Re-run existing undo/redo, validation-mode, selection, zone creation, zone
  drag, zone resize, actor selection, rendering, paint, and external-drop tests
  because Motion must not change Redux/history behavior.
- Perform a manual light/dark visual pass for fills, borders, labels, selection
  outlines, faction outlines, clipping, cursor states, and layer order.

If implementation reveals an unlisted animation, interaction ambiguity, or
event ownership conflict, stop and resolve it against the authoritative design
or ask before choosing new behavior.
