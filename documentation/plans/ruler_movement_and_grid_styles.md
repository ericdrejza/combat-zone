# Ruler, movement previews, and grid styles (#26, #33, #34)

## Approved behavior

- Grid Settings owns a positive whole-number distance per cell (default 5 feet), feet/meters/custom units (only feet and meters are concrete choices; standard distance names use abbreviations from mm through km and in/ft/yd/mi), independent of map sizing.
- Grid styles: Solid (default), Dashed, Dotted, Crosshair. Crosshair retains the outer quarter of each edge at both vertices, leaving its middle half empty. Preserve settings through alignment, detection, grid changes and resizing.
- Ruler immediately left of Select: Line, Circle, Rectangle, Cone, Path. Unfinished measurements are session-only and available read-only; locking and modifying saved artifacts require writer access. Ruler snapping always follows the Actors and Rulers grid snapping setting. Highlighting is derived from actor/ruler snapping, with no separate toggle. Canvas Settings chooses cell coverage: corners or center (default), center only, strictly more than half the cell area, corners plus the first forward cone cell, or corners plus all forward cells touching the cone origin. Corner thresholds are three on square/isometric grids and four on hex grids. Corner-or-center tests corners first. The cone-origin variants use the corner threshold without the center fallback; their extra cells exclude the source cell and must have actual cone overlap. The first-cell variant follows the centerline, resolving boundary ties with normal grid snapping. Other area shapes use the corner threshold in these two variants. Snapped Line rulers already form whole-cell routes, so their cell coverage is unchanged. Coverage and overlap fractions are evaluated in unprojected map geometry, independently of display warping and the rendered arc samples. Exactly half coverage is excluded from the majority mode. The local setting updates draft and saved-artifact highlights and optional cell-based area values without editing artifacts or adding encounter history.
- Shape subtools use icon buttons: Path (Waypoints), Circle (Radius), Cone, Rectangle, and Line (RectangleEllipsis rotated 90°), together in one button group. Remove the toolbar range field. The cone angle field uses an Angle icon, selects its text on click, and commits/blurs on Enter. Path is the default ruler subtool. Click to set shape endpoints or Path waypoints; only editable control points use dragging. Space locks an artifact, including edited artifacts, using only placed points; it never adds the cursor preview as a waypoint. The live cursor point is white and placed points are solid. A contextual Lock icon supports touch. Multiple locked artifacts remain through tool switches until deleted or cleared. Right-click a locked artifact for an Edit/Delete/Name/Color wheel (touch-hold on touch screens); editing Paths supports appending waypoints, and other shapes expose adjustable points. Left-clicks and short touch taps through saved artifacts place points for the active ruler, including snapped cell centers; saved artifacts do not block the live preview. While creating/editing, right-click anywhere on the ruler canvas—including editable points or another saved artifact—to pick up the last placed point, retaining earlier waypoints and the live cursor preview. Repeat to backtrack one point at a time. Removing the final draft point ends creation or restores the last saved version when editing. Escape cancels/restores the entire draft. Artifact context menus open only when no ruler draft/edit is active. Support explicit dimensions and angles. Locked artifacts persist in the encounter, including names and individual color/opacity overrides. Creating, deleting, clearing, renaming and changing appearance use encounter undo/redo. The artifact color dialog keeps edits local until Save commits one appearance action; Cancel discards them. Its palette toggle expands/collapses without closing the dialog, and Escape closes an open palette before cancelling the dialog. Cancel is at the lower left and Save at the lower right. Geometry edits remain temporary until Space locks them again as one history step; Escape restores the last locked version. Initial unfinished shapes never enter history. Clicking the second point of a two-point draft picks it up and returns to the live endpoint preview; dragging still adjusts a point.
- Measurements use unprojected grid space, rendered through rotation/projection/warp. Square circles start at vertices; snapped cones choose a source cell on the first click, then switch between its nearest side midpoint or corner according to the target trajectory. Side cones face outward from the source cell. There are no manual corner/side origin controls. Square cones default to 90°, hex cones to 60°. Unsnapped cones use the clicked origin. Shift+wheel in cone mode adjusts the angle; other wheel behavior is retained.
- Line is one cell wide. Choose the consistent repeating grid-step pattern that best reaches the target automatically; do not expose concrete orthogonal/diagonal pattern choices.
- Line/Path distance follows ruler snapping. Calculated area is disabled by default and can be enabled in Canvas Settings (geometric when unsnapped, summed highlighted-cell area when snapped). Circle labels show radius, cone labels show length and degrees, rectangles show width × height, and line/path labels show distance. Keep the complete artifact label within canvas bounds, fitting long names as needed.
- Canvas Settings provides a ruler color picker, manual #RRGGBB/#RRGGBBAA entry and opacity. Default appearance follows the theme; preferences persist locally and synchronize between tabs. “Ruler feel” offers “Rigid and Snappy” (default) and “Flowy and Flexible”; the latter adds spring flow and bounce to draft manipulation using Motion, respecting reduced-motion preferences. Locked shapes have identical geometry and appearance in both modes.
- Separate Ruler and Select with a vertical divider. R activates Ruler; N opens a rename dialog for selected actors, zones, or the targeted ruler artifact (including its active editing draft). T activates Annotation and B activates Background. In Ruler, 1–5 select Path/Circle/Cone/Rectangle/Line, 9 toggles actor movement distance, and 0 clears rulers. Canvas hints follow the current state: click to begin or continue a measurement, Spacebar to lock only when a draft can be locked, and right-click/touch-hold saved artifacts for options while idle.
- Combat diagonal policy: 1 (default), alternating 1–2, 2, or disabled. Hex retains six neighbors.
- Actor movement limits are optional and advisory in every validation mode. Unlocked movement previews routes; pressing Shift (or Space) during a drag fixes a pivot, preserving earlier segments and optimizing subsequent movement from the new pivot. No Add waypoint button is shown during a drag. The movement caption shows only distance and abbreviated units at the actor’s bottom right. A footwear icon in ruler subtools toggles that caption. Movement distance/range overlays end on pointer release, before a new actor position commits, so no new range boundary flashes on drop. The token itself retains its last pointer position during validation and settles from there to the accepted position, without replaying movement from its original position. Movement limits use a glow anchored at the drag origin with the available distance at drag start: whole reachable grid cells when snapped, a true radius when unsnapped. This is an advisory distance envelope, not obstacle pathfinding. Zone-locked movement has ruler only.
- Turn accounting defaults off and applies only to the active initiative actor. Reset per turn (default) or per round; the reset selector is enabled only while tracking is enabled. Count accepted drags/keyboard moves; exclude placement, removal, automatic packing and map changes. Carry alternating parity within accounting periods; otherwise restart per gesture.
- Movement and accounting commit atomically. Initiative changes, deletion and accounting changes preserve exact undo/redo. Changes to tracking/reset policy/costs/measurement units clear totals; limit edits retain totals.

## Implementation

1. Update DESIGN/ACCEPTANCE and add schema 28, migrations, local/Firebase validation.
2. Add shared measurement/route/AoE/accounting geometry; derive cells and paths instead of persisting them.
3. Extend Grid Properties/Settings and both SVG grid renderers for four styles.
4. Add interaction-only drafts, durable normalized locked rulers, responsive controls and focused pointer/overlay components outside CanvasShell. Commit only locks and saved-artifact mutations to history.
5. Integrate actor previews, waypoints, limits, Combat preferences and atomic movement accounting.
6. Verify geometry, cancellation/read-only behavior, validation, exact history, migration, local/cloud round trips, and responsive rendering.

## Verification

Run npm run test:agent, npm run typecheck, npm run build, and relevant Firebase emulator coverage. No styling assertions. Only mark roadmap acceptance complete once verified.

## Initial implementation verification

The initial implementation included Crosshair style and schema 28. Interaction refinements above supersede its original toolbar and drawing behavior.

- Full regression suite: 352 files, 1,999 tests passed.
- Final focused verification after import cleanup and added reset/limit history coverage: 62 tests passed.
- Typechecking passes for the application, Firebase API package, and Functions.
- Production build passes.
- Firebase emulator suite: 24 tests passed, including schema 28 invalid-write preservation.
- Isolated Chrome checks passed for desktop ruler drawing and area highlighting, actor drag/accounting, exact undo/redo, keyboard accounting, and compact touch drawing. No browser exceptions were recorded.

Ruler measurements remain transient; movement totals, actor limits, and grid settings
use the existing validated history and repository boundaries.

## Interaction revision verification

- Shared actor/ruler snapping also controls area highlighting; at least three covered corners include a cell.
- Shape and cone-origin controls use the requested icon buttons, with pressed states and desktop/touch tooltips.
- Shift pivots retain the earlier path; accepted movement and totals still commit together.
- Session artifacts support multiple locks, point editing/appending, and the contextual Edit/Delete/Name/Color wheel.
- Movement previews use abbreviated captions, a fixed-origin reachable-area glow, and the optional distance-caption toggle.
- Canvas ruler appearance accepts picker colors, manual hex alpha and opacity, with preference synchronization/reset coverage.
- Isolated Chrome verification passed for three-corner highlighting, multiple locked rulers, wheel editing, Shift pivot accounting, movement captions/ranges, and compact touch locking; no browser exceptions were recorded.
- Application/package typechecking and production build pass. The existing large-bundle build warning remains.
- Final full regression: `npm run test:agent -- --maxWorkers=2` passed all 2,017 tests across 354 files. The earlier four-worker run hit an existing panel test timeout; the isolated panel run and final full run both passed without changing that test.

## Ruler polish and drop-preview fixes

- End actor movement previews at release, before asynchronous validation or position publication; verify no destination-boundary flash.
- Group shape icons, use a rotated RectangleEllipsis for Line, remove the range field, and provide an Angle icon field with select-all and Enter/blur commits.
- Derive outward cone origins from the clicked source cell and target trajectory; remove manual side/corner controls.
- Include AoE cells with three covered corners or a covered center, checking corners first.
- Default calculated area off; add a Canvas preference, cone degrees, and Shift+wheel angle adjustment.
- Keep complete captions within map bounds, including long artifact names.
- Separate Ruler/Select; use D for Ruler, retain R for actor and Zone rename, and add scoped 1–5, 9, 0 ruler shortcuts plus the Spacebar hint.

Focused regression checks and isolated Chrome checks pass, including real SVG label bounds, angle field selection/Enter, outward side/corner transitions, and MutationObserver monitoring of movement ranges during drop. No browser exceptions were recorded. Typechecking and the production build pass; the existing large-bundle warning remains.

Final verification: all 2,031 tests across 357 files pass (`npm run test:agent -- --maxWorkers=2`). After retaining the validating-phase operation guard, 13 focused movement/history/ruler checks and the final production build also pass.

Zone rename synchronization: the Properties name field refreshes immediately after hotkey rename and undo/redo without reselection. Regression coverage verifies that blurring the refreshed field cannot overwrite the new name; all 13 targeted ruler/Zone Properties tests pass.


Latest refinements implemented:

- Schema 29 saves normalized locked ruler artifacts through the existing repository boundary, including autosave, draft recovery, export/import and Firebase validation. Schema 28 migrates to an empty collection; loading starts fresh history.
- Creation, deletion, clearing, renaming and appearance changes use standard encounter history. Editing geometry remains temporary until re-locking commits one step; Escape restores the saved version. A color-picker session coalesces into one appearance step.
- Idle, placing and editing states show relevant canvas hints. Clicking the second point picks it up without committing history; dragging continues to adjust it.
- Path is the default; Space locks only placed waypoints, never the hover point. The live cursor marker is white and placed markers are solid.
- Canvas Settings offers Rigid and Snappy (default) and Flowy and Flexible. Motion springs affect draft outlines and the cursor preview, respect reduced motion, and never alter saved geometry.

Browser checks pass for endpoint pickup, live replacement, history grouping, cancel/restore, autosave/reload, fresh history on reload, Path defaults, white preview points, clicked-waypoint-only locking, flexible motion and compact rendering. Firebase emulator tests pass (25 tests), and type checking and the production build pass. Final full regression: all 2,086 tests across 362 files pass (`npm run test:agent -- --maxWorkers=4`). Type checking, the production build and all 25 Firebase emulator tests pass.

Saved-artifact input refinement: primary clicks and short touch taps place through saved artifact hit targets, while idle right-click/touch-hold still offers artifact options. During creation/editing, right-click over another saved artifact picks up the last placed point without opening that artifact’s menu. The same backtracking gesture applies over editable points and empty canvas. Regression coverage includes snapped start/end placement, preview forwarding, touch tap/hold separation and context suppression for both new drafts and existing edits.


Cell coverage settings: add five Canvas options (corner threshold or center; center only; strictly over half; corners plus first forward cone-origin cell; corners plus all forward cone-origin cells). Use 3 corners for square/isometric and 4 for hex. Keep cone source cells excluded from the origin exceptions and require genuine forward overlap. Compute majority coverage analytically, without tying it to rendered arc resolution. Preferences persist locally, synchronize across tabs and reset to corner-or-center; changing them updates existing artifacts without a history commit. These are configurable coverage conventions, not a claim of universal D&D rules compliance; cone geometry remains unchanged. The official [D&D cone definition](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary#ConeAreaofEffect) is separate from these grid inclusion choices.

Cell coverage verification: all 2,099 tests across 364 files pass (`npm run test:agent -- --maxWorkers=4`); type checking and production build pass. Isolated browser checks verify all five Canvas choices, center versus majority, one versus two hex-origin neighbors, unchanged saved geometry/history, and compact settings layout with no runtime exceptions.


Color dialog and backtracking refinements: the controlled palette toggle closes the picker; custom RGB sliders and hex entry retain arbitrary color selection. Color edits remain local until Save; Cancel discards them, and unchanged Save preserves inherited values. The dialog footer places Cancel left and Save right. Right-click now picks up only the last placed ruler point across empty canvas, editable controls and other artifacts; earlier points remain, and Escape cancels the complete draft. Exhausting an existing edit restores the saved artifact without an encounter mutation. Verification: 41 targeted tests across seven ruler/shared-color/Canvas Settings files pass, as do type checking and the production build. Real-browser checks pass for picker toggle, Cancel/Save, hex alpha, compact footer layout, repeated point pickup, edit history grouping and exact undo; no browser exceptions were recorded.


Actor drop origin-flash fix: retain the lead token’s visible pointer endpoint in its motion track while Motion owns the drag. On the handoff to validation/settling, do not construct a keyframe replay from the original placement, even when a completion callback arrives before the track effect. The regression fails before the fix and passes both normally and under React Strict Mode; existing rejected-drop and cross-zone motion cases still pass. A browser run with delayed validation records 62 frames inside the drop-to-snap corridor, with movement overlays hidden after release and no browser exceptions.

Commit verification: the final full suite passes all 2,117 tests across 367 files (`npm run test:agent -- --maxWorkers=2`), including the actor drop handoff regression. All 25 Firebase emulator tests, workspace type checking, and production build pass. Actor Properties now places Movement limit before Type as requested.
