# Status panel implementation plan

This plan records the approved Status panel behavior and its supporting Combat
settings, actor resources, persistence, and tests. Properties describes lasting
entity details; Status exposes frequently changed actor details. Implement the
panel in `src/ui/panels/StatusPanel.tsx`, with tests in `tests/ui/panels`.

## Panel layout and selection

Render the sections in this order:

1. Actor name or names, read only.
2. Health status.
3. Hit points.
4. Counters.
5. Conditions.
6. Weapons.
7. Armor.

For one selected actor, expose all sections. For multiple selected actors, show
all names, hide health editing and custom counters, and allow bulk damage,
healing, and condition, weapon, and armor toggles. With no actors selected, show
a selection prompt. Connect the panel to both desktop and compact panel layouts.

Keep controls and hooks in focused modules under a snake_case directory such as
`src/ui/panels/status_panel`. Use existing tooltip, dialog, switch, and accessible
icon-control patterns.

## Health status

Share the health catalog with Initiative. Use the existing actor status as the
single source of truth:

| Value | Status | Lucide icon |
| --- | --- | --- |
| 0 | Dead | Skull |
| 1 | Unconscious / severely injured | BoneFracture |
| 2 | Injured | HeartCrack |
| 3 | Healthy | HeartPulse |

The Status panel health control is single selection. It excludes Initiative's
Delete action, which removes initiative membership without changing actor status.
Manual health changes remain available when automatic health is enabled. A manual
override lasts until an effective HP change or explicit application of Combat
rules recalculates it.

Preserve the existing Initiative behavior: dead actors have muted text and the
optional, default-on name strikethrough; Start and forward/backward stepping skip
dead actors. An active actor who dies keeps the turn until the next step. When
all actors are dead, Start and stepping do nothing and the buttons are disabled
with tooltips explaining why.

## Hit points

HP is optional and initially unset. Store current and maximum HP as integers;
maximum must be positive. Do not derive initial HP from system-specific stats.

Provide setup and editing controls in the Status panel. When first entering a
maximum, default current HP to that maximum while allowing a different starting
value. Separate maximum editing from clicking the displayed maximum: clicking
the displayed maximum asks for confirmation before resetting current HP to it.

Use HeartMinus for damage and HeartPlus for healing. Accept a positive integer
amount and apply the same amount to each eligible selected actor. Tooltips name
the action and explain disabled controls.

If some selected actors lack configured HP, show a Cancel/Continue dialog listing
the actors that will be skipped before making any mutation. Continue applies the
change only to configured actors in one history entry. If all selected actors
lack HP, disable damage and healing with an explanatory tooltip.

HP limits apply to damage, healing, direct edits, setup, and maximum edits. An HP
operation that leaves the effective current/maximum tuple unchanged must not
erase a manual health override or create a history entry.

## Counters

Custom counters belong to individual actors and are editable only for a single
selected actor. Shared Systems templates are future work.

Each counter has a stable ID, name, integer current value, and optional integer
minimum and maximum. Support create, edit, remove, and increment/decrement by
one. Require minimum to be no greater than maximum. Clamp edits, increments,
decrements, and limit changes to the configured bounds.

When a maximum is configured, clicking its displayed value asks for confirmation
before resetting the current value to it. Editing limits uses a separate control.
Actor duplication retains counter values; later edits to either actor remain
independent.

## Conditions

Conditions are independent, multiple-selection markers. They introduce no
automatic mechanics, durations, or other effects. Show icon toggles in
alphabetical order by display label, with descriptive tooltips and accessible
active, inactive, and mixed states.

For bulk selection, clicking a marker removes it from every selected actor when
all selected actors already have it. Otherwise, apply it to all selected actors.
Preserve unknown existing `statusEffects` strings.

The complete approved catalog is:

| # | Condition | Lucide icon |
| --- | --- | --- |
| 1 | Aiming | Crosshair |
| 2 | Assisted / Helped | Handshake |
| 3 | Bleeding | Droplet |
| 4 | Blessed | Sparkle |
| 5 | Blinded | EyeOff |
| 6 | Bolstered | BicepsFlexed |
| 7 | Burning | Flame |
| 8 | Charmed | Magnet |
| 9 | Concentrating | Brain |
| 10 | Confused | Shell |
| 11 | Cover | BrickWallShield |
| 12 | Cursed | BadgeX |
| 13 | Deafened | EarOff |
| 14 | Disguised | HatGlasses |
| 15 | Enchanted | WandSparkles |
| 16 | Energized | Zap |
| 17 | Exhausted / Fatigued | BatteryLow |
| 18 | Flying | Feather |
| 19 | Frightened | Ghost |
| 20 | Grappled / Grabbed | HandGrab |
| 21 | Guarded / Shielded | ShieldCheck |
| 22 | Hasted / Quickened | SportShoe |
| 23 | Hidden / Concealed | EyeDashed |
| 24 | Immobilized | Anchor |
| 25 | Incapacitated | Ban |
| 26 | Inspired | Lightbulb |
| 27 | Invisible | EyeClosed |
| 28 | Marked | LocateFixed |
| 29 | Muted / Silenced | MouthOff |
| 30 | Paralyzed | LockKeyhole |
| 31 | Petrified | Stone |
| 32 | Poisoned | Biohazard |
| 33 | Powerless | ZapOff |
| 34 | Prone | ArrowDownToLine |
| 35 | Resistant | ShieldHalf |
| 36 | Restrained | Link |
| 37 | Sickened | Thermometer |
| 38 | Slowed | Snail |
| 39 | Stunned | Galaxy |

Use stable lowercase kebab-case condition IDs based on the first label before a
slash, preserving existing IDs such as `hidden`. Cover belongs to Conditions.
Upgrade `lucide-react` and its lockfile to version 1.45.0 to include MouthOff and
Galaxy alongside the other approved icons.

## Weapons and armor

Weapons are independent toggles, displayed in this order:

| Label | Lucide icon | Marker ID |
| --- | --- | --- |
| Fist | HandFist | weapon:fist |
| Sword | Sword | weapon:sword |
| Swords | Swords | weapon:swords |
| Axe | Axe | weapon:axe |
| Bow | BowArrow | weapon:bow |

Armor allows at most one known tier per actor, displayed in this order:

| Label | Lucide icon | Marker ID |
| --- | --- | --- |
| No armor | ShieldOff | armor:no-armor |
| Light armor | ShieldMinus | armor:light |
| Medium armor | Shield | armor:medium |
| Heavy armor | ShieldPlus | armor:heavy |

Selecting an armor tier replaces other known armor markers for each selected
actor. If every selected actor already has the clicked tier, clear it from all
of them. Clearing a tier does not automatically select No armor. Preserve
unrelated and unknown markers.

## Interface settings

At the bottom of Interface settings' Panels section, add a Health counter name
text setting, defaulting to “Hit points”. This global preference controls the
built-in counter label; do not duplicate it on actors. Trim nonempty names and
use the default for blank input.

Keep the existing standard switch for strikethrough dead actor names in
Initiative, enabled by default.

## Combat settings

Add a Combat tab to Settings, using the Swords icon. General tabs become Audio,
Combat, Interface, and Keybinds. Keep Combat preferences in a dedicated durable
provider under `src/ui/combat_preferences`, using an application-namespaced key
such as `combat-zone.combat-preferences`.

Support three mutually exclusive HP-limit modes:

1. Clamp damage at zero and healing at maximum — default.
2. Allow negative HP and cap healing at maximum.
3. Allow negative HP and healing above maximum.

Automatic health starts off without default thresholds. Each upper cutoff is
optional; blanks disable automation for that status. The automation switch appears first and gates all threshold controls below it.
It can be enabled before cutoffs are configured. Disabling it hides the controls
and retains saved cutoffs; clearing every cutoff leaves it enabled without
automatic status changes.

Use one shared unit selector: fixed HP or percentage of maximum HP. Configured
cutoffs must be ordered by severity, skipping blanks; fixed values are integers
and percentages range from 0 through 100. Ties select the most severe configured
status. Values above all configured cutoffs are Healthy. Manual status selection never blocks future automatic triggers, including
when that status has a blank cutoff.

Autosave toggles/selects immediately and cutoff inputs on blur. Reject invalid
drafts without overwriting saved settings. Remove Save and Apply controls.
Enabling automation or changing valid cutoffs/units recalculates configured
Actors’ statuses without changing HP, in one validated undoable command. HP-limit
changes affect subsequent HP edits. No-op calculations create no history, and
stale queued calculations are canceled when superseded by newer settings.

Preference changes are not encounter history entries. Follow existing local
storage synchronization and reset conventions. Include the new preference key
in both normal local reset and interrupted-reset recovery, and restore defaults
on `LOCAL_PREFERENCES_RESET_EVENT`.

## Domain state and mutation boundaries

Extend Actor with optional `hitPoints: { current: number; maximum: number }` and
an actor-owned normalized custom-counter collection. Counter records contain
`id`, `name`, `value`, and optional `minimum` and `maximum`. Store HP only in its
built-in field; do not duplicate it in generic counters. Store condition,
weapon, and armor markers in the existing `statusEffects` array.

Implement pure immutable actor mutation helpers and focused resource validators.
Commit every domain change through the existing validation pipeline and Redux
snapshot history. Keep the central persistence writer guard authoritative for
read-only sessions. Bulk commands and HP changes with automatic health updates
each create one atomic history entry. No-op commands create none.

Capture affected actor IDs and apply dialog-confirmed operations to current
state. Avoid committing stale snapshots after asynchronous validation. Record
the relevant rules in action payloads where needed for clear action logs.

Extract reusable validated mutation and health-catalog behavior where it improves
clarity; do not couple Status actions to Initiative-specific APIs. Keep source
modules under 300 lines where practical and use path aliases across directories.

## Persistence and cloud compatibility

Advance encounter schema version from 12 to 13. Migrate version 12 actors with
HP unset and empty custom-counter collections, and retain existing supported
older migration paths. Preserve unknown status-effect markers.

Persisted HP must have an integer current value and a positive integer maximum.
Negative and above-maximum current values remain valid independently of local
Combat preferences. Validate counter structure, integer values, and configured
bounds before data enters Redux. Reject unsupported newer schemas and preserve
the last valid data on failures.

Keep all persistence behind `WorkspaceRepository`. Ensure resources survive
autosave, explicit save, draft recovery, load, import/export, duplication, and
cloud serialization. Loading restores fresh history and clears transient state.

Update `packages/firebase_api` to accept encounter schema 13 while preserving
its existing tested legacy schema 7 support. Cloud serialization retains full
actor resource fields; local cloud record loading migrates and validates before
Redux. Add emulator coverage for the new schema and resource round trips.

## Implementation sequence

1. Upgrade Lucide; add shared health and marker catalogs.
2. Add actor resource types, pure mutations, automatic-health rules, and validators.
3. Add schema 13 migration and persistence/cloud validation support.
4. Add Combat preferences, provider composition, settings, synchronization, and reset.
5. Add the Interface health-name preference.
6. Build the Status panel and focused controls/dialogs; wire all panel layouts.
7. Verify history, validation, persistence, read-only behavior, and cloud integration.
8. Update `documentation/DESIGN.md`, `documentation/ACCEPTANCE.md`, and
   `documentation/ROADMAP.md` to reflect the approved behavior. Check completion
   boxes only after the required verification passes.

## Verification

Add meaningful Vitest coverage for:

- Single, multiple, and non-actor selection; read-only names; health single selection.
- Catalog order, mixed bulk toggles, armor replacement, and unknown-marker retention.
- HP setup, all three bounds modes, direct edits, maximum reset confirmation,
  partial-selection skip confirmation/cancellation, and disabled reasons.
- Custom-counter creation, editing, removal, bounds, increments/decrements,
  reset confirmation, and independent cloned counters.
- Fixed and percentage thresholds, inclusive boundaries, tied thresholds,
  configuration validation, manual overrides, effective HP changes, and Apply now.
- Atomic undo/redo for bulk markers, resources, counters, and HP plus health;
  no history entries for no-op commands.
- STRICT blocking invalid candidates and ADVISORY not blocking them; central
  writer-boundary enforcement.
- Interface and Combat preference defaults, persistence, synchronization, reset,
  and explicit encounter application.
- Schema 13 round trips and migrations, invalid resources, unsupported newer
  schemas, repository failure preservation, draft recovery, import/export, and
  unknown markers.
- Cloud API legacy 7 and new 13 compatibility, serialization, and emulator
  resource round trips.

Use `npm run test:agent` or Vitest with `--reporter=agent`. Run typecheck, build,
and the relevant Firebase emulator tests. Do not assert CSS styling. Preserve
unrelated user edits, including staged toolbar changes. If unrelated tests fail,
ask for expected behavior before changing them.


## Implementation and verification

Implemented the panel, actor resources, marker catalogs, Combat preferences,
Interface counter label, schema 13 migration, cloud API compatibility, and
resource action-log descriptions. Updated DESIGN, ACCEPTANCE, and ROADMAP.

Verification completed:

- Full `npm run test:agent`: 207 files and 964 tests passed.
- Focused follow-up coverage passed, including cancellation of an asynchronous
  resource command when navigation changes the encounter.
- `npm run test:emulator`: 3 files and 10 tests passed, including a schema 13
  resource round trip through Firestore.
- `npm run typecheck`, `npm run build`, and `npm run build:functions` passed.
- `git diff --check` passed.

No unresolved product questions. Shared Systems counter templates remain future
work as agreed. No deployment or external publication was performed.

### Shared counter editor refinement

- Always show the header “Edit counters” pencil before Add counter, including when no counters exist.
- Remove per-row edit/remove icons; select counters from the shared editor dropdown.
- Preserve all edited fields and removals in one draft across counter selections;
  mark changed counter names with a pen indicator.
- Save the entire draft as one undoable change. On closing a dirty editor, offer
  Save changes, Discard changes, and Keep editing; disable saving invalid drafts.
- The “Edit counters” dropdown ends with Create new counter; creating selects a
  new empty draft counter. Pen indicators appear only alongside dropdown names.
- Current-value stepping buttons and keyboard steps respect configured bounds.

### Combat visibility preferences

- Autosave individual condition visibility using alphabetically ordered wrapped icon
  toggles; hidden conditions still show when active on any selected Actor.
- Use the shared Interface Eye/EyeOff controls for a Conditions master override
  and all-or-nothing Weapons and Armor section visibility.
- Preserve individual condition choices under the master override. Equipment
  sections hide even when active; Actor markers remain unchanged.
- Default to all shown and persist/synchronize/reset with Combat preferences;
  display preferences remain outside encounter history.

### Initiative condition display

- Show active condition icons immediately after Actor names with name tooltips.
- Measure the name and icon strip in the owning window; replace the full strip
  with Activity if it cannot fit. Hover/focus lists all condition icons and names.
- Clicking any condition icon asks to remove it from its Actor; validate and
  record confirmed removal with undo/redo, preserving other markers. Read-only
  windows can inspect, and cancel/backdrop/Escape leave conditions unchanged.

- HP and counter decrement/increment controls, including modal fields and the
  damage/healing amount, support hold-to-repeat with an enabled tooltip hint.
  Repetition stops on release, cancellation, leaving the control, or reaching
  a bound. Apply damage and Apply healing remain single-click actions.

## Zone Status extension

Approved for this session:

- Single-Zone Status shows read-only name, counters, clocks, tags, and notes.
  Multiple Zones show a single-Zone selection prompt.
- Reuse Actor counter behavior and draft editors through owner-independent
  controls and shared counter helpers.
- Share Edge Enter-created tag pills and blur-saved multiline notes; move Zone
  tags out of Properties. Property export excludes all Zone status fields.
- Clocks store stable ID, name, progress, and 1–12 segments (default four).
  Start at zero, use Clock N names, clamp progress on resize, and have no
  automatic completion effect. SVG circles fill clockwise from the top.
- Clock progress uses ±1 with hold-to-repeat and inline value editing; clicking
  the total confirms filling. Add/Edit uses the shared counter draft workflow.
- Validate and persist Zone resources with encounter schema 14, explicitly
  migrating 12 → 13 → 14. Retain cloud schema 7 and 13 compatibility.
- Verify history, no-op behavior, validation modes, read-only writer enforcement,
  migrations, local recovery/import/export, cloud round trips, and Actor/Edge
  regressions before checking completion.

Implemented and verified:

- Full `npm run test:agent`: 221 files and 1,083 tests passed.
- `npm run typecheck`, `npm run build`, and `npm run build:functions` passed.
- `npm run test:emulator`: three files and 11 tests passed, including schema 14
  Zone resources and retained schema 13 Actor compatibility.
- `git diff --check` passed.

Shared controls live under `src/ui/controls` and shared counter/tag helpers under
`src/core/entity_resources`. Clock counter-shaped adapters are derived UI data;
durable clocks store ID, name, progress, segment count, and style.

A follow-up question was raised about Ctrl-drawn Zone cloning: whether it should
also copy counters, clocks, and notes. No change to the existing cloning path
was made while that question awaits an answer. It currently copies tags and
visual properties; the new resource collections start empty on creation.

### Traditional and Linear clock styles

- Add a per-clock style, Traditional by default. Traditional keeps the radial
  segmented rendering; Linear uses filled boxes in a four-column grid with
  left-aligned segments, including partial rows.
- Arrange clocks as mini cards in two columns, showing name, centered visual,
  then the current value/stepping controls below. Place /maximum beside the
  visual without moving its center; retain clicking the maximum to confirm filling.
  Keep the existing zero-to-segment-count bounds and all progress mechanics.
- Expose style in Add/Edit clocks and a durable Interface > Defaults preference
  for newly created clocks. Existing clock styles remain independent of this default.
- Use encounter schema 15 with explicit 14 → 15 migration to Traditional, keeping
  cloud compatibility for schemas 7, 13, and 14. Validate persisted style values.
- Verify draft preservation, undo/redo, bounds, defaults, synchronization/reset,
  persistence/migration, and cloud compatibility.

Verification completed:

- Full `npm run test:agent`: 221 files and 1,096 tests passed.
- Final card/maximum-control follow-up: five files and 43 tests passed.
- `npm run typecheck`, `npm run build`, and `npm run build:functions` passed.
- `npm run test:emulator`: three files and 13 tests passed, including both schema
  15 clock styles and retained schema 7/13/14 compatibility coverage.
- `git diff --check` passed.

### Full-clock reset

Clicking the displayed maximum on a full clock offers a confirmation to reset
progress to zero. A clock below maximum retains confirmation to fill. Both
styles retain their segment count and style. Cancellation leaves progress and
history unchanged; confirmed resets use the existing validated writer boundary
and one undoable history entry. Verified with 62 focused tests and a production build.

The Actor and Zone counter section heading and accessible name are “Counters”.
