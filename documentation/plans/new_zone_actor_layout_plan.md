# Polygon FLEX Actor Layout

## Implementation status

The logic phase is implemented. `framer-motion` is installed but intentionally
unused until the canvas animation phase is explicitly approved. The requested
`@itecgo/nesting` package is no longer available from the npm registry, and its
linked GitHub repository is unavailable as well, so the project uses the
package-independent adapter contract described below with a deterministic
TypeScript polygon-footprint solver in `src/core/layout/nesting_ts.ts`.

  ## Summary

  - Add framer-motion as a deferred animation dependency.
  - Keep the unavailable @itecgo/nesting integration behind a replaceable
    adapter boundary; the current adapter is project-owned TypeScript logic.
  - Apply polygon-packing placement to FLEX zones of every shape because all
    zone shapes expose polygon geometry under the hood.
  - Keep SEQUENTIAL and split strategies on their existing algorithms.
  - Do not modify ActorLayer, CanvasShell, drag previews, or animation behavior yet.
  - Preserve the no-coordinate-persistence rule.
  - Reject any move or creation that cannot fit without overlap, in every validation mode.
  - Update the design documentation to record this new universal no-overlap invariant.

  @itecgo/nesting is an older TypeScript irregular-nesting package with limited published API documentation, so it will be isolated behind a
  project-owned adapter rather than imported throughout the layout system. Package reference (https://npm.io/package/%40itecgo/nesting)

  ## Implementation Changes

  - Create a polygon-packing module under core/layout/ with a stable application API:
      - polygonal zone boundary
      - actor IDs, sizes, and rendered shapes
      - optional incoming actor/drop point
      - configurable packing settings
      - packed target points
      - fit status and failure reason

  - Add named settings with easy-to-edit defaults:
      - preferred zone border gap: 16px
      - minimum zone border gap: 4px
      - adaptive padding step: 4px
      - actor-to-actor gap: configurable, defaulting to the existing 16px
      - configurable circle footprint segment count

  - Use rendered footprints:
      - rectangle actors become square polygons based on their radius
      - circle actors become configurable regular-polygon approximations

  - Prefer the polygon center for a single actor, but validate its complete
    footprint before accepting it; if it does not fit, use the normal candidate
    search to move it to a valid in-zone position.
  - For multiple actors:
      - attempt packing with the preferred border gap
      - retry with progressively smaller gaps down to the minimum
      - post-validate containment, border clearance, and pairwise non-overlap
      - return fits: false if no valid packing exists

  - Adapt the existing FLEX branch to use the new packer for every zone
    polygon shape.
  - Keep these paths unchanged:
      - SEQUENTIAL
      - all split strategies

  - Accept an optional incoming drop point in the pure placement API and return it alongside the packed target. This prepares the later
    animation phase without persisting coordinates or changing the canvas now.

  - Add a placement validator that evaluates the candidate nextEncounter:
      - actor moves and actor creation into FLEX zones of every shape are checked
      - multi-actor moves are atomic
      - universal packing failures block the action in OFF, ADVISORY, ASSISTED, and STRICT
      - existing mode behavior remains unchanged for unrelated validation errors

  - Extend the validation pipeline so invariant validators can run in OFF mode and explicitly mark an action as blocking.
  - Route the shared validation result through the existing history preparation path so rejected moves create no Redux history entry.

  Completed in the logic phase:

  - `src/core/layout/nesting_ts.ts` packs square and regular-polygon actor
    footprints with deterministic candidates, adaptive border spacing, and
    explicit fit failure.
  - `src/core/layout/polygonFlexLayout.ts` provides the shared FLEX strategy
    boundary.
  - `src/core/validation/polygonFlexPlacementValidator.ts` evaluates the
    candidate next encounter and blocks invalid actor moves/creations in all
    validation modes.
  - No actor coordinates were added to persisted state, and no canvas or
    animation code was changed.

  ## Documentation

  Write the complete plan to:

  documentation/plans/new_zone_actor_layout_plan.md

  Also update:

  - documentation/DESIGN.md to document universal no-overlap blocking and adaptive border spacing.
  - documentation/ACCEPTANCE.md with polygon FLEX packing and rejection criteria.
  - documentation/ROADMAP.md with the corresponding feature checkbox, checked only after tests pass.

  ## Tests

  Add Vitest coverage for:

  - one actor centered when its footprint fits, and moved by the fit algorithm
    when the center would intersect an irregular polygon boundary
  - multiple actors packed without overlap
  - rectangle and circle actor footprints
  - containment inside the zone
  - preferred 16px border spacing
  - fallback spacing at 12px, 8px, and 4px
  - rejection when no valid packing exists
  - incoming drop-point preservation in the pure placement result
  - deterministic actor ordering and stable placement output
  - FLEX packing using the new packer for rectangle, circle, hexagon, and
    user-drawn polygon zones
  - actor creation rejection in every validation mode
  - rejected actions producing no history entry
  - accepted moves preserving normal undo/redo behavior

  No Framer Motion tests or canvas animation tests belong in this phase.

  ## Later Animation Phase

  Only after explicit approval:

  - install/use Framer Motion in the canvas layer
  - capture the pre-change rendered placements
  - use the incoming drop point as the new actor’s animation origin
  - animate the new actor and all displaced actors to their packed targets
  - handle rejected moves by leaving the existing canvas state unchanged
