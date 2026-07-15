The executable actor-placement path is:

ActorLayer → src/ui/canvas/actorCanvasLayout.ts:142 → layout helper → SVG translate(x y) in src/ui/canvas/ActorLayer.tsx:58.

The important distinction: src/core/layout creates descriptors and groups; the actual coordinate math lives under src/ui/canvas/.

### Common inputs

- Actor radius: 30 × size multiplier
    - small 0.75, medium 1, large 2, xLarge 3
    - src/entities/actor/actorVisuals.ts:3

- Actor order comes from actors.allIds.
- Moving an actor updates currentZoneId and moves it to the end of allIds.
    - src/entities/actor/actorMutations.ts:169

### Rectangle/polygon zones

For rectangle zones, non-split strategies use src/ui/canvas/actorCanvasLayout.ts:68.

SEQUENTIAL uses a square-ish row-major grid:

columns = ceil(sqrt(actorCount))
rows = ceil(actorCount / columns)

column = index % columns
row = floor(index / columns)

x = bounds.x + radius
    + ((column + 0.5) / columns) * (bounds.width - 2 * radius)

y = bounds.y + radius
    + ((row + 0.5) / rows) * (bounds.height - 2 * radius)

The implementation is src/ui/canvas/actorCanvasLayout.ts:68. Despite the design document mentioning corners for sequential non-circular zones,
the current implementation uses this grid.

FLEX uses a candidate-placement solver in src/ui/canvas/actorFlexLayout.ts:125:

1. Generate candidates from:
    - inset polygon vertices
    - polygon edge midpoints
    - polygon center
    - a bounding-box grid

2. Keep candidates inside the polygon.
3. Prefer candidates at least radius + 16px from the zone edge.
4. Reject candidates overlapping previously placed actors.
5. Choose the candidate maximizing distance from already placed actors.
6. For a single actor, use the zone center.

The public entry point is src/ui/canvas/actorFlexLayout.ts:229.

### Split strategies

SPLIT_FLEX and SPLIT_SEQUENTIAL first group actors into hero, neutral, and enemy sections in src/core/layout/strategies.ts:30.

The zone is divided proportionally using each section’s total actor diameter plus a 16px gap:

sectionWeight = Σ(actorRadius * 2 + 16)
sectionSize = totalZoneAxis * sectionWeight / totalWeight

This happens in src/ui/canvas/actorCanvasLayout.ts:87.

Actors are then placed along the axis perpendicular to the split by src/ui/canvas/actorSectionLayout.ts:43:

- SPLIT_FLEX: evenly distributes actor centers between section edges, using the largest actor radius for margins.
- SPLIT_SEQUENTIAL: uses fixed spacing of maxRadius * 2 + 16, centered in the section, then clamps positions to the section bounds.

LEFT_RIGHT creates vertical sections and places actors along the Y axis. TOP_BOTTOM creates horizontal sections and places actors along the X
axis.

ringRadius = zoneRadius - maxActorRadius - 8
actorSpacing = maxActorRadius * 2 + 8
x = center.x + cos(angle) * ringRadius
y = center.y + sin(angle) * ringRadius

- FLEX: actors are evenly distributed around each ring.
- SEQUENTIAL: actors start at -π/2 (top) and advance clockwise using an angular step derived from the desired chord spacing.

The shape switch is here: src/ui/canvas/actorCanvasLayout.ts:176.

One important quirk: actor shape (circle versus rectangle) does not affect layout math. Both render using the same radius and 2 × radius
footprint; shape only changes the SVG primitive in ActorLayer.tsx.