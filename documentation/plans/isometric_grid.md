# 2:1 isometric grids

## Accepted behavior

- Add Isometric — 2:1 alongside Square and Hex. Unrotated diamonds are 64×32
  logical units; Cell size retains its existing map-scale meaning.
- Use square topology projected by `x = (u-v)/2`, `y = (u+v)/4`, followed by
  origin and rotation. Inverse conversion supports the same placement rules,
  occupancy, Zone snapping, Cell Tracer, and completed boundary cells as Square.
- Large reserves four cells around a vertex; xLarge reserves nine around a
  center. Arrow movement uses four edge-sharing neighbors, choosing the most
  aligned screen direction and breaking equal alignment clockwise.
- Manual alignment samples four consecutive diamond vertices, in either winding
  and from any starting corner. Support quadrant/warped alignment and automatic
  background detection through the existing preview and Apply/Cancel workflows.
- Add a browser-local Settings > Canvas switch, “Project tokens on isometric
  grids”, off by default. Project canvas artwork, backgrounds, and outlines;
  keep names upright and logical footprints, hit areas, and reservations intact.
  Library/Zoneless and external transfer previews stay upright. Projection follows
  nominal grid rotation, not local bilinear distortion. Use Motion and respect
  reduced motion. Isometric Trim retains Square behavior.

- Isometric is the last type option in the Align to Grid modal.
- Rotation clicks step by 0.1 degrees; holding for 400ms accelerates to 1 degree
  every 80ms. Round displayed/saved rotation to the nearest hundredth.
- Leave implementation uncommitted until user testing.

## Implementation

1. Centralize square topology and isometric projection, with exact inverse.
   Connect geometry, reservations, Zone translation, rendering, and warp safety.
2. Add the grid type to Properties, Settings, calibration, and detection. Preserve
   existing commit/preview semantics and worker cancellation/failure behavior.
3. Add the Canvas preference with backwards-compatible loading, reset, and
   cross-tab updates. Keep presentation transforms separate from placement.
4. Advance encounter schema 22→23 without changing prior geometry; update local
   migrations and Firebase contracts/validation together. Older versions must
   migrate correctly; unsupported versions preserve the last valid document.
5. Update DESIGN, acceptance criteria, and ROADMAP after verification.

## Verification

Cover projection/inverse, dimensions/rotation, anchors and arrow neighbors,
all Actor reservations, locked/unlocked movement, Zone geometry and Cell Tracer,
boundary completion, manual/quadrant alignment, warp safety, detection with noise
and rotation, cancellation, UI commit semantics, undo/redo, STRICT/ADVISORY and
read-only guards, repository/import/export migrations and Firebase contracts,
preference reset/synchronization, upright names and unmodified footprints.
Run focused tests, the complete agent suite, typechecks, and production build.

## Status

Implemented and verified; awaiting user testing. Changes remain uncommitted.

- Complete agent suite: 293 files, 1,602 tests passed.
- Firebase emulator suite: 3 files, 23 tests passed.
- Root, Firebase API, and Functions typechecks passed.
- Production build and whitespace checks passed.

## Quadrant navigation and supplied-map detection follow-up

Four-quadrant alignment now includes a corner jump for the current sample set,
starting at top-left and advancing after each completed cell. Navigation retains
zoom, its temporary restoration lease, samples, and encounter history. Removing
a point or resetting samples updates the destination; completion hides it.

Tested `temp/BLANK_Dungeonmap_iso.jpg` (4,942×3,826) through the production
two-pass pixel detector at 384×297 and 1,152×892. Both passes return no match.
The supplied map has three line families with normals at 0°, 60°, and 120°,
corresponding to a 30° triangular/isometric lattice rather than 2:1 diamonds.
Ridge confidence at 60°/120° is about 0.82/0.83, while the required 2:1 normals
63.435°/116.565° have no reliable fit. Supporting 30° geometry requires a
product choice; existing 2:1 detection has not been changed to misidentify it.

## Configurable isometric angle — accepted follow-up

- Add optional persisted grid.isometricAngle, 1–45°, in Grid Settings only.
  Keep Apply/Cancel; absence uses atan(0.5), retaining exact 2:1 geometry.
- Projection remains 64 units wide with height 64×tan(angle). Apply the angle
  consistently to inverse/snapping/warps/calibration/rendering/token projection.
- Detect projection angle automatically from two oblique line families.
  Rename the type to Isometric and keep it last in alignment.
- Advance schema 23→24; retain exact legacy geometry and synchronize Firebase
  contracts. Reject invalid ranges and older schemas claiming explicit angles.
- The supplied map now detects at about 29.94°, rotation 0°, and 111.85-pixel
  diamond width. Checked overlays near top-left, center, and bottom-right.
  The thumbnail remains inconclusive; the larger pass supplies the result.

Final follow-up verification: 294 application test files / 1,617 tests passed;
3 Firebase emulator files / 23 tests passed. Root/API/Functions typechecks,
production build, and staged/working-tree whitespace checks passed. The supplied
JPEG detection test also passed with the final peak-filtering implementation.
Temporary probe removed; permanent angle/navigation/migration regressions retained.
Implementation remains uncommitted pending user testing.

Rotation follow-up: held changes continue in 0.1° steps after the repeat delay,
clamp the final fractional step to the next whole degree, then repeat in 1°
steps. Isometric tokens is the final Canvas Settings section.
