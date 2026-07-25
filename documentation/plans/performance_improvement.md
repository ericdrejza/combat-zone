# Performance Improvement Log

This is the working audit, baseline, implementation, and results log for actor
packing and automatic zone resizing. Timings in the baseline section describe
the code before the performance implementation.

## Goals and measurement contract

- Primary workload: 50 actors in one polygon FLEX zone.
- Interaction target: less than 100 ms end-to-end for packing, static-zone
  actor addition, and automatic resizing.
- Responsiveness target: less than 16 ms of main-thread blocking. Work that
  cannot meet this limit must remain off the UI thread.
- FLEX layouts may change exact coordinates, but must remain deterministic,
  contained, non-overlapping, and evenly/symmetrically spread through the zone.
- Browser comparisons must run the same 12-, 25-, and 50-actor fixtures in
  forced CPU and real WebGPU modes. Retain WebGPU only when the 50-actor median
  is at least 20% faster and neither smaller fixture regresses.

## Luna analysis audit — 2026-07-19

### Traced computation-resource, worker, and GPU paths

1. `CanvasShell` defaults to `PROACTIVE` and schedules proactive placement
   after every encounter object change. Each eligible FLEX or SEQUENTIAL zone
   creates eight speculative jobs (four actor sizes times two shapes).
2. `actorPlacementWorkerClient` sends the full encounter snapshot to the
   placement worker. If another request is pending, it terminates and recreates
   the worker, losing initialized worker/JIT/WebGPU state and all in-flight
   progress.
3. The placement worker first calculates authoritative geometry on the CPU.
   Proactive jobs then optionally create a WebGPU accelerator and execute
   serially, yielding with `setTimeout` between jobs.
4. WebGPU accelerates only squared-distance calculation for a fully materialized
   candidate grid. For every actor rank operation it creates four GPU buffers,
   uploads candidates, dispatches, copies results to a readback buffer, waits
   for `mapAsync`, copies scores, performs the final sort in JavaScript, and
   destroys all buffers. Polygon containment and actor collision tests remain
   entirely CPU-bound. This transfer/readback overhead is likely larger than
   the two arithmetic operations being offloaded at current encounter sizes;
   it must be measured in a real browser before retention.
5. The selected `'CPU' | 'WEBGPU'` value is stored in the module-global
   computation-resource registry. The validation pipeline includes it in its
   worker request, but `validation.worker.ts` never reads it. Consequently,
   reporting `WEBGPU` does not accelerate validation or automatic resizing.
6. Validation itself uses a persistent worker, but automatic FLEX-zone
   adjustment and resizing run synchronously before the async validation
   request is made. The most expensive resize work can therefore still block
   the main thread.

### Packing hot spots

- Candidate generation scans the complete bounding-box grid for every actor
  after yielding its preferred target. With the default 8 px step, candidate
  count `C` grows approximately with polygon area divided by 64 rather than
  with the number of useful nearby positions.
- For every candidate, two new polygon footprints are allocated. A circle
  allocates 16 points each time. Containment performs point-in-polygon and
  edge-intersection work against all zone vertices.
- Each candidate then scans every previously placed footprint. SAT collision
  testing allocates both polygons' axes, projection arrays for every axis, and
  concatenated axis arrays. No AABB, circle/rectangle primitive test, or
  spatial broad phase rejects distant actors first.
- `tryPack` calls `actors.slice(0, actors.indexOf(actor))` while evaluating
  SPLIT_FLEX candidates. This adds repeated linear searches and arrays inside
  the candidate loop. The bounded backtracking fallback repeats footprints,
  containment, all-prior collision scans, and prefix slicing for as many as
  `max(5000, N * 2500)` search nodes.
- Target computation repeatedly recalculates polygon bounds, polygon center,
  and largest actor radius. Rectangle SEQUENTIAL layout rebuilds all rows and
  all targets for each actor. Current FLEX targets use a single ring, so dense
  layouts do not initially spread actors across the full usable polygon and
  fall into the grid scan.
- A pack tries four border spacings with current defaults (16, 12, 8, 4) when
  earlier passes fail, multiplying all candidate and collision work.

Let `N` be actors, `B` border-spacing attempts, `C` grid candidates per actor,
`F` footprint vertices (normally 16 for circles), and `V` zone vertices. The
current greedy bound is approximately:

`O(B * N * C * (F * V + N * F^2))`

It also has very high allocation volume inside the innermost loops. SPLIT_FLEX
adds a bounded backtracking term and has an exponential search shape before
its node cap.

### Automatic resize and duplicated packing

- Center/anchor scaling performs one initial pack, up to 20 doubling packs,
  and 20 fixed binary-search packs: up to 41 complete packs.
- Per-vertex/rectangle-side expansion performs one initial pack, up to 20
  growth packs, and 24 fixed binary-search packs: up to 45 complete packs.
- Searches use fixed iteration counts rather than a pixel tolerance and do not
  estimate a useful first scale from actor area or the largest footprint.
- The successful packing placements are discarded. `PolygonPlacementValidator`
  immediately gathers the same zone actors and packs the final polygon again.
  Even a zone that already fits is packed once by adjustment and once by
  validation.
- Actor gathering scans every encounter actor for every affected zone. Render
  geometry similarly scans all actors per zone and calls `calculateZoneLayout`,
  which scans all actors and engagements again. Proactive job construction and
  proactive plan lookup repeat the same per-zone actor scans.
- Every resize candidate checks every other zone. Although polygon collision
  has an internal AABB check, bounds for both polygons are recomputed for every
  candidate/neighbor pair before edge testing.

The worst resize/validation path is therefore roughly 42–46 times the packing
bound above, plus `O(searchPasses * zones * polygonCollision)` and repeated
whole-encounter scans.

### Cache and orchestration overhead

- Actor placement cache keys JSON-stringify all positioned zones, polygons,
  actors, relevant engagements, and settings. Separate proactive keys
  repeatedly stringify the same zone and actor population for lookups.
- Authoritative render calculation loops through every zone and filters the
  whole actor collection for that zone. `getActorRenderPlacements` performs
  more full actor scans for stale optimistic state and affected-zone discovery.
- A generation check prevents stale proactive jobs from publishing, but only
  between complete jobs. The synchronous pack itself has no cancellation
  boundary.

## Original baseline

Environment: Intel Core i7-9700K (8 cores/8 threads, 3.60 GHz), Node 24.18.0,
Vitest/Vite SSR, CPU only. Measurements warm the operation once and report the
median of three samples unless noted.

| Flow | Actors | Original median |
| --- | ---: | ---: |
| Direct FLEX pack, 1400 × 1000 rectangle | 12 | 0.510 ms |
| Derived render geometry, same fixture | 12 | 0.541 ms |
| Direct FLEX pack, 1400 × 1000 rectangle | 25 | 1.555 ms |
| Derived render geometry, same fixture | 25 | 1.418 ms |
| Direct FLEX pack, 1400 × 1000 rectangle | 50 | More than 60,000 ms; benchmark interrupted |

The 50-actor timeout is the critical baseline finding: growth is highly
non-linear once single-ring targets collide and later actors exhaust the large
bounding-box grid. Because the direct 50-actor pack did not finish within one
minute, the dependent static-add (51 actors) and auto-resize measurements were
not reached in this initial run. The implementation benchmark must preserve
this timeout as a lower-bound comparison and add bounded, repeatable baselines
for all named interaction flows.

The existing performance test is insufficient as a product baseline: it uses
12 actors, measures five samples of lazy render calculation versus a
precomputed map lookup, does not include the cost of generating all eight
plans, has no resize/validation flow, no 50-actor threshold, no p95 or work
counters, no event-loop blocking measurement, and no real WebGPU execution.
The existing test passed in 117 ms total test time on this machine, but the
agent reporter does not expose its internal console timing and suite duration
must not be treated as operation latency.

## Implementation starting points

- Prepare polygon bounds/edges, actor ordering, target points, and shape data
  once per pack; generate deterministic best-first candidates around multi-ring
  FLEX targets rather than scanning the full grid.
- Use primitive footprint overlap checks and an operation-local spatial hash so
  a candidate queries nearby actors only. Keep polygon geometry as the
  authoritative containment/fallback path.
- Group actors and engagements by zone once per encounter snapshot and compute
  only source, destination, or reshaped zones.
- Reuse successful packing evidence across adjustment and validation. Seed
  resize from footprint area/largest actor estimates and stop a
  doubling/binary search at 0.5 px tolerance with at most 12 search packs.
- Move adjustment and validation together to the validation worker, preserving
  the synchronous no-Worker fallback.
- Prefer affected-zone lazy calculation unless end-to-end measurements show
  that eight speculative plans improve latency. Replace worker termination
  with generation-based stale-result rejection and safe cancellation checks.

## Post-implementation results

### Luna performance tests

`tests/performance/actorPackingPerformance.test.ts` exercises five CPU-only
flows with 50 mixed circle/rectangle medium actors. Each flow receives three
JIT warmups followed by ten measured samples and reports median and p95
latency. The fixture uses a 920 × 600 zone inside the application's actual
960 × 640 canvas; this is denser and more representative than the original
1400 × 1000 baseline fixture.

The direct packing test additionally verifies repeatability, polygon
containment, pairwise non-overlap, centroid balance, coverage across all four
quadrants, and use of at least 60% of both zone dimensions. Every timing test
enforces a 100 ms median and 150 ms p95 ceiling.

### Measured CPU results — 2026-07-19

Environment: Intel Core i7-9700K (8 cores/8 threads, 3.60 GHz), Node 24.18.0,
Vitest/Vite SSR, CPU only.

| Flow | Actors | Median | p95 |
| --- | ---: | ---: | ---: |
| Direct FLEX pack, 920 × 600 rectangle | 50 | 0.813 ms | 1.075 ms |
| Derived render geometry | 50 | 0.713 ms | 1.088 ms |
| Add actor to static FLEX zone through validated preparation | 50 | 0.643 ms | 0.703 ms |
| Add actor and automatically resize FLEX zone | 50 | 1.841 ms | 2.397 ms |
| Undersized manual reshape and dynamic correction | 50 | 2.240 ms | 3.411 ms |

The five median interaction costs total 6.250 ms. Every measured p95 remains
below the 16 ms main-thread responsiveness target, even though runtime UI
validation also retains its worker path.

The original direct 50-actor pack did not complete in 60,000 ms. Compared with
the new 0.813 ms median, the directly measured hotspot saves more than
59,999 ms per calculation, or more than 99.9986%. The original dependent
static-add and resize cases were never reached after that timeout, so an exact
before/after percentage for those flows would be fabricated; their new
combined median is 4.724 ms. A conservative overall estimate is therefore
greater than 99.99% for the previously blocking 50-actor interaction family.

### Resulting algorithmic cost

- Axis-aligned high-count FLEX rectangles now precompute a centered,
  aspect-aware grid. When capacity permits, every actor accepts its first
  target, making the expected packing path `O(N * (F * V + q))`; `q` is the
  bounded spatial-hash neighborhood rather than all prior actors.
- General polygons use lazy best-first candidates and spatial broad phase:
  expected `O(N log N + K * (F * V + q))`, where `K` is the number of
  candidates actually visited. The degenerate fallback remains bounded by the
  finite candidate grid and can approach the original grid-dependent worst
  case for adversarial concave geometry.
- A combined collision-footprint-area lower bound rejects impossible polygons
  in `O(N + V)`, avoiding candidate search during early resize probes.
- Automatic resize uses an estimated first scale, at most six growth and six
  refinement attempts, a 0.5 px tolerance, and canvas-bounded anchored
  scaling. This replaces the prior 41–45 complete packing passes and avoids
  exhaustive work when the requested polygon is plainly too small.

### WebGPU status

`tests/performance/browser/placementBenchmark.ts` runs identical 12-, 25-, and
50-actor fixtures for 20 samples through forced CPU and real WebGPU paths,
reporting median, p95, speedup, adapter availability, and the retention
threshold. No WebGPU adapter measurement was available in the Node/Vitest
environment used for the results above, so no GPU time or retention verdict is
invented here. Hardware acceleration should remain conditional until that
browser harness reports at least a 20% 50-actor median improvement with no
12- or 25-actor regression.

### Verification

- `npx vitest run tests/performance/actorPackingPerformance.test.ts --reporter=agent`
  — 5 passed.
- `npm run typecheck` — passed.
