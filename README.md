# Combat Zone

Combat Zone is a zone-based tabletop RPG encounter management tool for Game Masters. It replaces grid combat with polygonal zones, engagement groups, directional movement edges, and direct manipulation of actors on an encounter canvas.

## What it is

The app is designed to reduce GM overhead while keeping encounter state clear and editable in real time. Core concepts are:

- Zones: polygonal spatial regions
- Actors: creatures, NPCs, objects, objectives, and points of interest
- Engagements: melee interaction groups with transitive membership
- Edges: directional relationships between zones
- Annotations: notes, markers, arrows, and measurements

## Product goals

- Preserve GM authority first
- Favor direct manipulation over modal workflows
- Model space as narrative abstraction, not simulation
- Keep interaction tool-driven instead of global mode-driven
- Make every state mutation reversible through commands

## Domain rules

- Every mutation is represented as a command with `do()` and `undo()`
- Undo/redo must restore exact prior state, including cascades
- Zone deletion does not delete contained actors; they become zoneless
- Deleting a zone auto-deletes connected edges as part of the same reversible command
- Engagements are groups, not pairwise links
- Engagements auto-dissolve when participant count drops below 2
- Edges are explicit graph relationships, not derived from canvas geometry

## Tech stack

The implementation is built around a locked stack:

- TypeScript
- React
- SVG rendering
- Redux Toolkit
- Vite
- Vitest
- Tailwind CSS

## Repository layout

```text
src/
  core/          shared command, layout, validation, and rendering engines
  entities/      zone, actor, engagement, edge, and annotation features
  interaction/   tools and selection logic
  ui/            toolbar, panels, and canvas shell
  store/         Redux store setup
documentation/   design, architecture, and acceptance criteria
```

## MVP scope

The current MVP focuses on:

- Drawing and editing polygonal zones
- Dragging actors between zones and onto the canvas
- Creating and merging engagement groups
- Creating directional edges between zones
- Initiative tracking
- Tool-specific selection and drag behavior
- Full undo/redo coverage
- Local persistence and round-trip save/load

See `documentation/DESIGN.md` and `documentation/ACCEPTANCE.md` for the 
authoritative product rules and testable scope.

## Status

This repository is still early-stage. The docs define the intended product and architecture more completely than the current implementation.
