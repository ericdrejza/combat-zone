# Coding Agent Instructions

## ROLE

You are an expert frontend-heavy full-stack engineer building a zone-based TTRPG encounter management system.

Your job is to implement a production-quality application based strictly on the provided design document.

## CORE OBJECTIVE

Build a browser-based encounter canvas tool that allows Game Masters to:

- Define zones (polygonal regions)
- Place actors into zones
- Create engagement groups
- Define edges between zones
- Track initiative and encounter state
- Dynamically modify encounters during play

## CRITICAL DESIGN CONSTRAINTS

### 1. No simulation logic

Do NOT implement RPG rules engines.
Only represent state and relationships.

### 2. GM overrides everything

- Validation is advisory unless Strict mode enabled
- Never block GM actions unless explicitly in STRICT mode

### 3. Everything is a command

All state changes must go through:

Command → Validation → State Update → History

### 4. Entities are unified

All canvas items must conform to:

- Zone
- Actor
- Engagement
- Edge
- Annotation

Each must support:

- select
- move
- serialize
- delete
- undo/redo

### 5. Tool-driven UI

The toolbar determines interaction mode:

- Select tool defines selection rules
- Zone tool defines drawing behavior
- Edge tool defines connection behavior
- Actor tool defines placement behavior
- Engagement tool defines grouping behavior

NO global mode system.

### 6. Layout system is pluggable

Zones and engagements must use:

- FLEX
- SEQUENTIAL
- SPLIT_SEQUENTIAL

via strategy pattern.

### 7. Engagements are GROUPS

- Engagement = collection of participants
- Must support merge and split via drag operations
- No pairwise engagement logic

### 8. Edges are directional graph objects

Edges must support:

- directionality
- movement rules
- visibility rules
- interaction tags (free-form)

Edges are NOT geometry-based.

### 9. Actor placement behavior

Actors:

- may be free-placed or auto-positioned depending on zone strategy
- must return to previous position if invalid drop occurs
- can exist in:
  - zone
  - engagement
  - zoneless state

### 10. Selection rules are tool-dependent

Implement:

- Shift selection
- Ctrl selection behavior
- Box selection
- Type-based selection isolation

### 11. Undo/Redo is mandatory

Every state mutation must generate:

- reversible command
- history entry

### 12. Persistence

Must support:

- local autosave
- manual save/load
- JSON export/import

## ARCHITECTURE EXPECTATIONS

You should structure the system using:

### Frontend

- Canvas rendering engine (React or similar)
- State management with command pattern
- Event-driven interaction system

### Core Modules

- Interaction Engine
- Layout Engine
- Validation Pipeline
- Command System
- Entity Store
- Rendering Layer

## DATA MODEL RULES

Implement these core entities:

- Encounter
- Zone
- Actor
- Engagement
- Edge
- Annotation

Keep models normalized.

## INTERACTION PIPELINE

All interactions must follow:

User Input

1. Tool Handler
2. Interaction Engine
3. Validation Pipeline
4. Command Creation
5. History Store
6. State Update
7. Layout Recalculation
8. Render

## UI REQUIREMENTS

- Toolbar-driven interaction
- Collapsible side panels
- Properties panel (context-aware)
- Initiative panel
- No modal-heavy workflows
- Tooltip under every tool

## NON-GOALS

Do NOT implement:

- Full RPG rules engines
- Dice rolling systems (unless later added explicitly)
- AI narrative generation
- Cloud backend in MVP
- Multiplayer sync in MVP

## SUCCESS CRITERIA

The system is successful if:

- A GM can run a combat encounter entirely within the canvas
- Zones, actors, and engagements can be created and modified live
- No workflow requires leaving the canvas
- Undo/redo works reliably for all actions
- State remains consistent under rapid interaction

## FINAL NOTE

This is a real-time tactical abstraction tool, not a game engine.

Prioritize:

- clarity
- speed of interaction
- predictability
- minimal UI friction
- strong undo safety
