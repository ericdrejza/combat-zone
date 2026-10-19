# Zone rotation controls

## Summary

Add rotation to every zone shape through a draggable handle visible when the zone is selected with the Zone tool. Preserve orientation through resizing, shape conversion, undo/redo, and persistence.

Status: implemented and verified. The completed behavior includes the snapping and synchronized handle-motion refinements below.

## Controls and interaction

- Draw a thin stem from the zone’s local top-center to a Lucide `RotateCcw` icon, above zone bodies alongside resize handles.
- Rotate around the center of the zone’s local bounding box, fixed at gesture start. Calculate rotation from pointer angle changes without jumping when dragging begins.
- Use grab/grabbing cursors, visible hover/focus feedback, established desktop and touch-hold tooltips, and a zoom-independent hit target.
- Display signed clockwise rotation in [−180°, 180°), rounded to whole degrees. Match the edge curvature label’s typography, outline, and theme colors.
- Show the label beside the handle only with the Zone tool and zone selection. Hide a rounded 0° value when idle; show it throughout active rotation.
- Preview continuously without history mutations. Release commits one validated action. Escape, pointer cancellation, lost capture, tool changes, or encounter changes cancel safely.
- Rotating one selected zone affects that zone only. Respect the central read-only writer guard.

## Geometry, layout, and state

- Add persisted `Zone.rotation` in degrees, defaulting existing zones to zero. Keep `polygon` authoritative for world geometry; rotation records editing/layout orientation. Do not persist a second polygon or derived bounds.
- Introduce shared world/local coordinate helpers. Resize generated shapes in their local frame, transform handles back to world coordinates, and align resize cursors with their displayed directions.
- Preserve rotation when converting shapes. Generate replacement shapes within local bounds; converting to Polygon retains outline and angle. Polygon vertex edits retain editing orientation.
- Keep gesture state and workflows in focused helpers/hooks; leave `CanvasShell` responsible for composition.
- Feed preview polygons into rendering, rotation stems/handles, hit testing, connected-edge routing, and gesture presentation, including hiding the Zoneless panel. Use the same Motion settling/cancellation transition for Zone geometry and rotation controls, honoring reduced motion.
- Keep the stem, icon, label, and hit target attached to the continuously dragged zone, including when vertex snapping is enabled. On release, leave direct manipulation and settle the body and controls synchronously, including while validation is pending.

### Snapping and zone contents

- With zone vertex snapping enabled, preview free rotation and reconcile vertices on release. Reconciliation searches nearby grid rectangles closest to the released bounds controls, preserving generated shape identity while allowing independent width/height and aspect-ratio changes plus a nearby valid angle. Store and display the resulting angle. Resizing retains the current angle and fixed opposite control. Reject fits with no valid bounds. Polygons snap every stored vertex.
- Rectangles, circles, and hexagons jointly snap all four oriented bounds-control corners so reconciliation does not regenerate an axis-aligned shape. Reject invalid reconciled geometry through existing placement checks.
- Only the four bounds-control corners must snap for generated shapes; circle/hexagon outline samples, intermediate generated edge samples, and side-handle midpoints need not snap. Custom polygons snap every stored vertex and merge consecutive coincident vertices.
- Shape preservation does not preserve aspect ratio. For example, the rectangle with corners `(1,0), (2,0), (2,3), (1,3)` released at −45°, or near it, settles to `(0,1), (1,0), (3,2), (2,3)` on a square grid. The result remains rectangular, and both the stored angle and degree label become −45°.
- Match snapped rectangle corners to actual grid coordinates so floating-point rotation drift cannot reject a corner on the canvas boundary.
- With Zone lock enabled, rotate actor and engagement centers with the zone while keeping artwork and token sizes upright. Transform split sections and connectors consistently.
- Preserve valid unsnapped locked placements after release through orientation-aware derived layout, including reload and undo/redo. Do not persist placement caches. Repack through existing validated fit behavior when snapping makes those placements invalid.
- With actor grid snapping enabled, rotate centers during preview and repack onto valid grid placements on release.
- With Zone lock disabled, leave actor positions stationary and reevaluate membership.
- Commit geometry, rotation, and cascades atomically. Preserve hard overlap/canvas constraints and existing validation-mode behavior. Integrate pending gesture ordering so stale validation cannot overwrite newer work.

## Persistence and documentation

- Use encounter schema 27, migrate older zones to `rotation: 0`, and validate finite, normalized angles before Redux hydration. Do not add the separately discussed repair-on-load migration for previously skewed rectangles.
- Preserve rotation through repository saves, recovery, export/import, and existing cloud serialization boundaries.
- Update DESIGN and ARCHITECTURE with agreed behavior and state contract. Add acceptance criteria and a roadmap entry; mark complete only after verification.

## Validation

- Geometry: all shapes, positive/negative angles, wraparound, stable pivot, orientation-preserving resize/conversion, and snapped reconciliation.
- Interaction: tool/selection visibility, zero-label rules, pointer movement at zoom, cancellation, read-only enforcement, and one history entry per completed gesture.
- Layout: rotated actor/engagement centers, upright artwork, all strategies, snapped repacking, fit fallback, unlocked membership, and restoration after reload.
- History/validation: exact undo/redo of angle, polygon, and cascades; rejected edits preserve state; mode-dependent blockers block in STRICT without blocking ADVISORY.
- Persistence: legacy migration, invalid angles, round trips, export/import, and unsupported versions.
- Run `npm run test:agent`, type checking, and production build. Verify behavior rather than CSS styling.

### Completed verification

- `npm run test:agent -- --maxWorkers=2`: 344 files and 1,941 tests passed.
- `npm run typecheck` and `npm run build`: passed.
- Regression coverage includes the example above, nearby released angles, changed aspect ratios, generated shapes on rotated square/hex/isometric grids, snapped degree labels, pending-validation settling, follow-up moves, and exact undo/redo.
- Live Chrome verification was unavailable because automatic approval review could not start the local server while its reviewer model was at capacity.
