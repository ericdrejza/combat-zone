# Dice rolling, chat results, and Actor Rollables

## Summary

Implement GitHub issue #35 and sub-issues #73 (notation), #74 (presentation),
and #75 (actor actions) in milestones: full-notation text rolling first,
Actor Rollables and manual HP application next, then dice images and 3D.
Evaluate `@3d-dice/dice-ui` last.

Update `documentation/DESIGN.md` with the agreed behavior before implementation.
Update the architecture prohibition on dice systems to permit this feature.
Characters and Actor Templates remain outside this effort.

## Chat rolling and shared engine — #73

### Message syntax

- Support `/roll formula`, `/r formula`, and multiple `[[formula]]` expressions
  embedded in ordinary messages.
- Slash commands roll one expression; inline expressions produce separate
  results in message order.
- Validate every expression before evaluating the message. Invalid syntax or
  execution failure preserves the draft, explains the problem, and saves no
  message or partial results.
- Preserve desktop, mobile, multiline, and IME composer behavior.

### Notation

Use `@3d-dice/dice-roller-parser` behind an application-owned adapter. Support its
full notation: numbered/custom-sided dice, percentile and Fate dice, arithmetic,
parentheses, mathematical functions, keep/drop rules, explosion variants,
repeated/once-only rerolls, success/failure counting, critical markers, groups,
matching, sorting, labels, and calculated dice counts/sides.

Extend repeating modifiers with `~m`:

```text
/roll 3d6!~5
Attack [[2d20kh1+5]] and damage [[3d6!~5+2]]
```

- `m` means maximum extra rolls per original die, excluding its initial roll.
- Support the suffix on exploding, compounding, penetrating, and repeated-reroll
  modifiers. Omission defaults to 10 extra rolls; `~0` permits no extra rolls.
- When capped, retain generated results and the last reroll value. Mark affected
  chains and explain how to change the cap using `~m`.
- Enforce independent expression-depth, dice-count, operation, and execution-time
  budgets. Evaluate in a terminable worker so pathological input cannot block UI.
- Validate complete input consumption; malformed notation must not silently
  become a parser label.

### Result design

```text
Game Master
Attack [[2d20kh1+5]] and damage [[2d6+3]]

2d20kh1+5
[8 dropped] [17 kept] + 5                  Total 22

2d6+3
[4] [6] + 3                              Total 13
                                       [Heal] [Damage]
```

- Keep results below original text inside its message card.
- Show individual faces, modifier effects, discarded rolls, explosion chains,
  and final outcomes. Label success/match counts appropriately.
- Highlight minimum/maximum possible faces and explicit critical markers;
  distinguish kept/dropped status independently.
- Wrap results on compact screens; retain readable text in every presentation.
- Deleting a message deletes its results. The system-log toggle does not hide rolls.
- Dice Settings contains the complete notation guide, examples, cap explanations,
  and later presentation preferences.

## Actor Rollables and resolution — #75

### Definitions and editing

Actors own an ordered normalized collection of Rollables. Each definition has a
stable ID, name, optional check roll, required effect roll, None/Damage/Healing
effect kind, and optional Actor audio-group ID. None rolls normally and never
offers healing or damage application controls on its saved log card.

- Status has a Rollables section with launch controls and an Edit button.
- Edit the complete list in a responsive modal. The Rollable selector contains
  the ordered list and a Create new Rollable choice, matching counter-editor
  creation. Reordering keeps this dropdown open; choosing a Rollable selects its
  draft. Delete uses destructive red styling and shares the footer row with
  the Cancel/Save button group.
- Save commits definitions and order as one history step; Cancel discards drafts.
- Build reusable ordering controls with pointer/touch dragging and keyboard
  movement, then use the same component in counter and clock dialogs.
- Include order-only changes in dirty detection and persistence; preserve mappings.

### Invocation and targeting

```text
@Goblin/Slash
@"Goblin Chief"/"Heavy Strike" -> @"Town Guard"
@Cleric/Restore -> [@"Town Guard", @Scout]
```

- Provide autocomplete for actors, Rollables, and targets, plus quoted names and
  disambiguation of duplicate names.
- Resolve mentions to stable IDs; save display-name snapshots for history.
- Preview the candidate target with a pulsing faction-colored outline using
  Motion; respect reduced-motion preferences.
- Use one resolver interface for chat and Status launches.
- Play the linked Actor audio group once at launch with established effect/shuffle
  behavior. Resolution, refresh, and undo/redo do not replay it.

### Resolution flow

- Every Rollable requires an effect roll. With no check roll, roll the
  effect immediately.
- Check-and-effect rolls perform the check once, then open a resolution dialog.
- Multiple targets receive separate Success/Failure decisions. Roll the effect once for
  all hit targets.
- Offer Miss and a split Hit/edit button. Edit opens a one-use effect-formula
  editor with Back, Revert, and Roll. Overrides affect only this invocation.
- Dismissal leaves a durable pending result with Resolve controls in chat.
  Reopening never rerolls the original check.
- Snapshot definitions at launch. Later source edits/deletion do not change pending
  formulas or historical results. Deleted targets cannot receive HP changes.
- Deleting an audio group or moving it outside Actor groups clears Rollable links
  in the same undoable operation.

## Manual application and durable state

### Applying results

- Ordinary numeric sums offer Apply Healing and Apply Damage icons. Check results
  and success/match counts do not. Rollable effects show their configured kind.
- Application is always manual in this effort.
- Supplied targets use eligible hit targets. Without targets, open a multiselect
  actor picker grouped by faction with an icon toggle for an ungrouped alphabetical view.
- Each target amount starts from the unchanged rolled total:

```text
Target          Amount
Town Guard      [/2] [−] [13] [+] [×2]   [Pencil]
Scout           [/2] [−] [13] [+] [×2]   [Pencil]

                              [Apply Damage]
```

- `/2` uses integer division. Edits affect only that target and application;
  future applications start from the original result.
- Require a positive whole-number amount, matching existing HP controls.
  Fractional, negative, or zero totals require correction before application.
- Reuse HP bounds, health-status recalculation, and missing-HP handling.
- Apply all selected target adjustments in one undoable transaction.
- Persist application records with result ID, target ID, kind, and amount in that
  transaction. Derive indicators from these records; undo/redo restores both.
- Reapplication to an already affected actor requires explicit confirmation.

### Interfaces and persistence

Introduce focused types/services for requests, normalized result trees, Rollable
definitions, pending resolutions, and application records.

- Keep parser objects, workers, drafts, target previews, and renderer instances
  outside Redux.
- Extend durable chat with structured results/pending resolutions, independently
  of encounter undo/redo. Configuration and application records use history.
- Extend bulk HP commands for per-target amounts and atomic application records.
- Version/migrate encounter data: legacy chat remains text; old actors have empty
  Rollables. Cover recovery, import/export, ID remapping, and cloud validation
  through existing repository boundaries.
- Recheck writer permission and encounter identity before asynchronous results or
  dialog actions commit. Chat ignores spatial validation; configuration and HP
  changes use existing validation paths.

## Milestones

- [x] 1. #73 and textual #74: documentation, parser adapter, safety limits, chat
  syntax, durable result cards, Dice notation guide.
- [x] 2. #75 configuration: model, Status editor/launcher, shared ordering,
  counter/clock adoption, audio links.
- [x] 3. #75 workflows: mentions, previews, pending resolution, overrides, manual HP.
- [x] 4. Remaining #74: images, then 3D with `@3d-dice/dice-box` and
  `@3d-dice/dice-parser-interface`.
- [x] 5. Evaluate `@3d-dice/dice-ui` after native React flows; adopt only if useful.

3D uses a temporary canvas overlay, lazy-loaded assets, and the same normalized
result contract. Supported formulas use actual simulated faces for outcomes.
Unsupported formulas or renderer failures fall back to text with an explanation.
Never calculate unrelated text/3D outcomes. Keep permanent text results and do
not replay simulations on load.

## Verification

- Deterministic tests of every notation family, modifier combinations, precedence,
  `~m`, cap reporting, and hostile-input termination.
- Commands, multiple inline expressions, malformed input, draft preservation,
  result order, and composer keyboard/mobile behavior.
- Rollable editing, Save/Cancel, order-only changes, shared ordering, undo/redo.
- Quoted/ambiguous mentions, target lists, pending recovery, per-target Success/Failure,
  overrides, source changes, and audio firing once.
- Amount controls, integer halving, unchanged totals, missing HP, repeat
  confirmation, atomic application, and undo/redo.
- Persistence migrations, round trips, reference remapping, revision/write
  failures, read-only guards, cloud validation, stale asynchronous completion.
- Image/3D compatibility, fallback, asset loading, face/result agreement.
- Responsive dialogs, keyboard access, tooltips, reduced motion; no CSS assertions.

Run `npm run test:agent`, type checking, production build, and relevant Firebase
emulator tests. Add roadmap/acceptance entries for each milestone; check only
when implementation and verification are complete.

## Implementation notes

- Encounter schema 34 adds roll applications and structured chat results; schema
  33 migrates without changing its messages. Schema 35 requires effect rolls
  and adds None effects. Existing check-only definitions (including historical
  invocation snapshots) move their check roll into the effect field with None,
  preserving their single roll and non-applicable results. Rollable collections are actor-owned
  and absent legacy collections resolve to empty. Historical invocation snapshots
  remain independent from later definition edits/deletion.
- `@3d-dice/dice-roller-parser` is pinned to 0.2.6. Its adapter corrects upstream
  rounded random-face generation (which can produce sides+1), bounds every repeat
  variant, and retains compound/explosion face traces. Contract tests protect the
  narrow upstream modifier hooks. Parser-interface supplies 3D notation groups;
  physical results feed the same evaluator through an immutable face tape.
- Safety budgets: 2000 characters/formula, 32 nesting levels, 1000 parsed nodes,
  1000 maximum extra rolls/modifier, 10000 random draws/formula, and at most 20
  inline formulas/message. The text worker is terminated after 4 seconds, with
  an additional 3-second evaluator deadline. The 3D tray has a 100-die/20-second
  budget and falls back as a whole transaction on incompatibility or failure.
- The 3D renderer and its assets are lazy. `predev` and `prebuild` copy the
  installed package's MIT-licensed assets into ignored `public/dice-assets`;
  runtime URLs respect Vite's production base path. Unsupported dice, computed
  groups unsupported by the bridge, and graphics failures retain full text rolls.
- Apply receipts follow HP history, while chat/results and pending-resolution
  decisions remain outside history. Deleting chat does not change historical HP
  transactions. Source/target display snapshots remain readable after deletion.
- A main-window resolution host opens Status-launched checks even when Log is
  hidden. Pending rolls can also be resumed from their chat cards. All delayed
  work checks the encounter session and writer boundary before committing.
- `@3d-dice/dice-ui` was evaluated last and is unnecessary: native React components
  own the composer, nested result display, Rollable editors, and application
  dialogs. No dependency or imperative UI from that optional package is added.
- Verification includes deterministic notation tests, worker cancellation/timeouts,
  repository/cloud validation, autosave of pending decisions, undo/redo of per-target
  applications, counter/clock order-only edits, Strict Mode, and live Chrome checks
  on desktop and a 390px viewport. Firebase emulator coverage includes valid dice
  writes and atomic rejection of malformed replacements.

### Verification results

- Full agent suite: 454 files, 2850 tests passed.
- Final dice engine/UI checks after result-audit refinements: 8 files, 91 tests passed.
- Audio regression checks: 29 files, 182 tests passed.
- Firebase emulator suite: 4 files, 28 tests passed.
- Workspace/application/functions type checking and production build passed.
- Live Chrome checks passed for worker rolling, invalid-input preservation,
  per-target resolution, one-use formula overrides, integer halving, HP/receipts,
  compact Log dialogs at 390px, and an actual 3D d6 with no page errors.
- The first concurrent full-suite run hit the existing actor-creation test's
  5-second timeout. It passed in isolation and in the final full run without
  changing its behavior or timeout.

### Rollable editor refinements

- None effects hide all application controls on their log cards; effects are
  mandatory even when a check roll is configured.
- The selector owns creation and ordering. Selecting Create new Rollable selects
  its new draft; repeated reorder operations keep the selector open. Escape
  closes the selector before the editor.
- Delete Rollable uses the established red destructive styling and shares a
  footer row with Cancel/Save, including at a 390px viewport.
- Schema 35 migrates prior check-only definitions and invocation snapshots to
  equivalent None effects. Existing formulas/results remain intact.
- Verified with 302 focused dice/persistence/UI tests, 51 state/resource
  regression tests, 28 emulator tests, type checking, production build, and
  Chrome at desktop and 390px widths with no page errors.

### Shared list edit dialogs

- Rollables, Counters, and Clocks now use `ListEditDialog` for their common
  selection dropdown and red Delete / Cancel / Save footer. Standalone counter
  creation also uses the shared action row.
- `OrderedEditorSelect` portals an anchored modal menu to the owning document.
  It overlays editor fields without moving them, constrains focus while open,
  consumes outside dismissal clicks, and fits/resizes within the owning viewport.
  Selection/creation closes it; ordering keeps it open.
- Counter/clock names, dirty indicators, creation defaults, resource mappings,
  invalid drafts, confirmation flows, and one-step history remain unchanged.
- Verified by 410 dialog/panel tests, workspace type checks, production build,
  and Chrome checks for all three editors at 1440px and 390px widths. Browser
  checks include repeated reordering, focus containment, outside dismissal that
  does not activate the editor underneath, and keyboard flow back into fields.

### Dropdown drag-edge scrolling

- Shared Rollable, Counter, and Clock dropdown lists use Motion's frame loop
  and the existing panel edge-scroll helpers to scroll in the drag direction.
  A stationary edge pointer continues revealing and reordering hidden rows.
- Track only the initiating pointer in the owning window. Stop on release,
  cancellation, blur, hidden documents, disabled controls, or menu teardown.
  Ordinary hover/handle presses and arrow-button ordering do not start scrolling.
- Cache the pre-drag content extent so a translated row cannot grow the scroll
  limit indefinitely. Keep layout scroll tracking enabled for the dragged row.
- Preserve the open menu, selection, and existing Save/Cancel history boundary.

- Verification: 91 relevant UI regression tests and 56 final control/dice/scroll
  tests passed, with workspace type checking and production build. Live Chrome
  checks used 30-item Rollable, Counter, and Clock lists at desktop and 390px
  widths, holding the pointer stationary at both edges, checking final item
  order, keeping the menu open, and confirming scrolling stops on release.

### Formula notation help

Both Rollable formula labels have an info icon with desktop hover and touch-hold help, “Click to open dice notation.” Either icon opens Dice settings above the editor and scrolls directly to the Notation guide. The editor stays mounted to preserve unsaved changes; closing settings returns keyboard focus to the invoking icon. Help navigation is session-only and creates no encounter history.

### Chat completion, general references, and zone targeting

Implemented a shared reference grammar/resolver for suggestions, chat display spans, and Rollable targeting. Slash command suggestions cover `/r` and `/roll`; prefix matches sort before other substring matches. Arrow keys navigate, Tab/Enter/Space complete, and Escape dismisses. Keyboard and pointer suggestion focus share Actor previews, including all members of zone/faction candidates. Completion uses the caret and preserves manually entered quotes, adding quotes for names with spaces.

Plain references send as chat without entering the Rollable parser. Scoped references support `@Zone`, `@Zone.faction`, and `@Zone.Actor`, with Zone-filtered suggestions. The approved faction names are plural: heroes, allies, enemies, neutrals. Target expansion snapshots current membership, deduplicates overlaps, and rejects empty target sets. Actor/Zone name collisions require a choice.

Encounter schema 36 adds optional historical chat reference spans containing offsets, selected identity, entity kind, and display color. Schema 35 upgrades without inventing colors for old messages. Actor references use faction colors; Zone references use full-strength visible fill, border fallback, or default text. Qualified Actor references color the Zone and Actor portions separately. These snapshots survive rename/recolor/deletion and repository recovery/export/import; both local and cloud boundaries reject invalid spans before replacement.

Verification: all 459 test files / 2,897 tests passed with
`npm run test:agent -- --testTimeout=10000`; the longer per-test limit accommodates
an existing Library URL-link interaction that timed out under full-suite load
but passed unchanged in isolation. All 28 Firebase emulator tests passed,
including valid reference snapshot writes and atomic rejection of invalid spans.
Root/API/functions typechecks, production build, and desktop/mobile Chrome
checks passed. Browser checks covered command selection, prefix ranking,
keyboard Actor previews, plain references, scoped faction suggestions, and
expanded Zone targets. Focused tests also cover caret replacement without
suffix duplication, empty target blocking, color fallback rules, duplicate
selection, schema migration, and durable snapshots.

### Suggestion focus and canvas reference picking

Keyboard navigation hides the text caret while preserving native textarea focus
and selection, including IME input. All four arrows move suggestion focus;
typing resumes native editing at the saved insertion point. Textarea/document
selection-change listeners keep completion synchronized with caret movement.
Actor/Zone suggestions reuse primary toolbar icons; factions use UsersRound.
Accessible names retain entity kinds and duplicate-name Zone context. Send is
anchored inside a textarea-only wrapper so suggestions cannot move it downward.

Bare-reference suggestions prioritize the active initiative Actor, then selected
Actors. Name characters switch ordering back to prefix-first matching. A focused
bare `@` can also be completed by normal canvas selection of an Actor or Zone;
Engagement selection inserts participant Actor references, extending an existing
target list without nested brackets. The hook observes completed native canvas
clicks, checks the active tool's selection contract, and returns focus to chat.
Bindings preserve exact identities, and neither completion nor selection adds
encounter history or a new persistence relationship.

Verification for these refinements: 15 relevant test files / 141 tests passed,
including saved-selection typing, horizontal navigation, active/selected Actor
ranking, tool selection restrictions, already-selected Actor picks, duplicate
participant identities, and Engagement list insertion. Root/API/functions
typechecks and production build passed. Chrome checks passed at desktop and
compact widths for native caret synchronization, navigation, typing resumption,
icons, Send placement, and existing roll completion. Desktop canvas handlers
also verified active/selected Actor priority and Actor/Zone/Engagement picks.

### Roll-card result layout

The total and Apply-button container share a wrapping row, allowing a single
line when space permits. Whole-expression grouping parentheses are omitted,
including redundant outer single-child groups; nested arithmetic and named
function-call parentheses remain intact. Existing application controls and
conditional eligibility are preserved. Relevant dice/log tests: 15 files,
136 tests passed, including expression grouping checks.
Typechecks and desktop/compact Chrome checks also passed; visual inspection
confirmed totals and both Apply controls share the row without outer expression
parentheses.

### Repeated commands and roll-again cards

Added `/rr formula count` for 1–20 independent rolls in one atomic message,
including parenthesized formulas containing spaces. The command registry also
exposes `/rr` in autocomplete. Invalid formulas/counts preserve the draft and
never start a worker or publish partial results.

A clockwise Roll again icon appears immediately before Delete on rolled chat
cards and shares its hover/focus visibility container. It sends a new card by
re-resolving the original message against current references and current
Rollable definitions, preserving original results, decisions, HP, and application
receipts. Explicit duplicate choices are retained only while referenced names
still match; Zone/faction targets resolve current membership. Errors are scoped
to the encounter session, and writer/busy guards still apply.

Totals justify opposite the Apply controls. Damage precedes Healing when both
are available. Repeating-modifier guide examples omit explicit `~m` caps; the
separate Extra roll limits text and examples remain unchanged.

Verification: 19 relevant test files / 170 tests passed, covering repeat bounds,
atomic failure, independent outcomes/IDs, new-card rerolls, current definitions
and membership, duplicate choices, missing references, application preservation,
writer guards, and action order. Root/API/functions typechecks and production
build passed. Desktop/compact Chrome checks verified `/rr`, roll-again behavior,
unchanged prior cards, count rejection, current Rollable edits, and card layout.

### Actor token application picker and fixed sidebar boundaries

The application dialog now uses uniformly sized Actor token tiles with names
below and overlaid selection checks. Token rendering retains shape, saved crop,
and mirroring. A header UsersRound button replaces the alphabetical checkbox and
toggles faction sections versus the existing alphabetical order. Faction headings
include color circles. Actors without HP are disabled and muted, with hover/touch
help instead of static text. Amount editing stays in controlled per-Actor drafts
and survives regrouping; HP changes and receipts retain existing history rules.

Sidebar shells clip overflow and keep header/footer controls from shrinking;
only panel/tab viewports scroll. Keyboard suggestions now adjust their own menu
scroll position rather than calling ancestor-scrolling `scrollIntoView`.

Verification: 25 relevant test files / 232 tests passed with a 10-second per-test
limit for App interaction tests. Coverage includes both application dialogs,
image previews, keyboard tile selection, unavailable-HP help, draft preservation,
HP undo/redo, shared dialog controls, panel tabs/reordering, and menu-only keyboard
scrolling. Typechecks and production build passed. Desktop/compact Chrome checks
verified token grids, grouping, draft edits, and damage application. Native wheel
and programmatic scroll checks confirmed fixed footer controls in stacked,
tabbed, and collapsed-tab sidebars while panel content still scrolls.

### Canvas token previews and roll workflow refinements

- Reuse ActorVisual in application tiles to match canvas token artwork, faction
  fill, shape, crop, mirroring, and media preferences at a uniform preview size.
- Center each applied value independently of its edit toggle. Place decrement
  and increment beside the compact number input, suppress native spinners, and
  put edit/halve/double controls beneath.
- Derive per-tile reapplication markers and the centered card-footer target
  count from existing application receipts; undo/redo updates both.
- Show saved Rollable formulas on hover/focus, separated by middle dots, with
  non-None effect kinds italicized; provide equivalent touch-hold text.
- Label adjudication with the attack result, join Hit/edit corners, and space
  Undo2, RotateCcw, and Dices icon controls across the effect editor footer.
  Disable Revert to original only when the draft exactly matches its original.

Verification: 26 relevant files / 235 tests passed, plus 4 shared tooltip/token
renderer files / 21 tests. Root/API/functions typechecks and production build
passed. Chrome checks at 1440px and 390px verified token tiles, edited amounts,
receipt markers, the centered card footer, attack totals, joined controls, exact
Revert behavior, Back navigation, and effect rolling. Sidebar footer checks remain
passing across stacked, tabbed, and collapsed-tab layouts.

### Check roll modes and Success/Failure results

Use Check roll and Effect roll consistently in product
labels, accessible names, validation/help text, and documentation. Expression
property names remain `checkFormula`/`effectFormula` for compatibility.

Each Rollable gains a Check roll mode: One check for all targets (default), One
check per target, or Ask me. Ask me prompts before rolling only for multiple
deduplicated targets, with the two modes and Cancel; cancellation retains the
chat draft and sends nothing. Zero/one target uses one check without prompting.
Rollables without a check skip the setting. Per-target checks allow at most 20
targets, with clear guidance to reduce targets or choose a shared check otherwise.

A shared check shows Success when all targets succeed, Failure when all fail,
and Mixed when decisions differ. Its suffix appears beside the total only after
resolution. Per-target check cards identify their snapshotted target and show
that target's outcome after resolution; no aggregate total is manufactured.
Ordinary/effect rolls keep their existing total display. Success/Failure replaces
the previous terminology throughout resolution controls and accessible names. The dialog heading
is Check result: <total> for shared checks, or Check results with each target's
total in its row for per-target checks. Success/edit controls remain joined,
and Resolve targets aligns to the right.

Retain one shared effect roll when any target succeeds, initially selecting only
successful targets for application. Roll again uses current Rollable settings
and targets, including asking again when appropriate. Persist the configured
mode on Rollables, actual chosen mode on invocations, and target IDs on independent
check results. Schema 37 migration defaults older definitions and invocations to
shared checks. Keep stored hit/miss decisions, session/writer guards, cancellation,
atomic publication, history, and application behavior.

Verification will cover zero/one/many targets, duplicate and Zone-expanded target
sets, the 20/21 boundary, prompt cancellation, independent results and associations,
partial/resumed decisions, all outcome suffixes, shared effects/application,
current-state rerolls, settings undo/redo, migration, repository/cloud validation
and round trips, and desktop/compact browser interaction. Run relevant Vitest
suites, typechecks, production build, and persistence/emulator checks.

Implementation: `Rollable.checkRollMode` stores shared/perTarget/ask;
`RollInvocation.checkRollMode` snapshots the selected shared/perTarget mode;
`DiceResult.targetId` links independent checks to the invocation's saved targets.
The launching composer, Status Rollable, or roll-again control owns its cancellable
choice prompt, so a visible Log panel is not required. Schema 37 uses the same
validation for local saves and the Firebase API, preserving older shared results.
The Success/Failure display maps existing hit/miss decisions without rewriting
history. The user clarified the heading to Check result / Check results.

Verification completed: the full Vitest suite passed (469 files / 2,970 tests,
using a 10-second per-test limit). Focused new migration/mode tests passed again
after the final fixture updates. Two Firebase emulator tests passed, including
independent target associations and atomic rejection of corruption. Root/API/
functions typechecks and the production build passed. Chrome checks at 1440px
and 390px verified Ask me cancellation, shared/independent checks, Success/Failure/
Mixed outcomes, saved target bindings, success-only application selection,
current-state reroll prompts, Check result headings, and right-aligned resolution.

### Reference completion and log interaction refinement

Entity matches start with the first suggestion highlighted, so Tab, Space, or
Enter accepts it without an initial arrow press or sending the message. Preserve
existing match ranking and explicit identity bindings. Show the remaining name
as muted inline completion for prefix matches at the draft's end; keep preview
text out of the draft until accepted, and clear it on acceptance or dismissal.
Substring matches remain selectable without suggesting a misleading suffix.

Sent reference hover reuses the suggestion Actor-outline preview. Resolve saved
Actor identities directly, and derive current Zone/faction members for grouped
previews. Keep historical names/colors intact after changes and safely ignore
deleted entities. Show a pointer cursor; clicking selects the saved Actor or Zone
through the existing tool selection contract and Redux interaction actions,
without switching tools or changing encounter history. Provide equivalent
keyboard activation and focus feedback for reference controls.

Verify immediate completion with all three keys, ghost-text updates/dismissal,
scoped and quoted references, keyboard navigation/caret restoration, preview
cleanup, renamed/deleted references, and allowed/disallowed selection tools.

Verification completed: 204 dice tests passed, followed by 24 focused completion
and reference interaction tests after adding quoted/scoped coverage. Root/API/
functions typechecks passed. Chrome checks at 1440px and 390px verified immediate
Tab/Space/Enter completion, inline preview alignment, pointer cursors, Actor and
Zone outline previews, and reference click selection. `git diff --check` passed.

### Passive stale references, Zoneless reveal, and alphabetical sorting

Deleted Actor/Zone references render as plain spans with their historical color.
They have no button role, keyboard stop, activation, pointer cursor, or hover
styling. Existence is observed live so deletion/restoration updates the control.

Selecting a live Zoneless Actor publishes a session-only navigation request after
the active tool's selection guard succeeds. The request opens the appropriate
canvas panel, sidebar/tab, or compact drawer and reveals the selected token by
scrolling only its owning panel containers. Requests are scoped to the encounter
session and also reach newly mounted drawer contents. Navigation leaves saved
panel settings, encounter data, and history intact. Hidden/collapsed panels may
be shown transiently; manual panel controls continue to work.

The shared Rollable/Counter/Clock dropdown includes an ArrowDownAZ icon beside
Create new with the tooltip “Sort alphabetically”. It sorts draft names without
case sensitivity, retains the selected ID, and leaves the menu open. Existing
Save/Cancel and history behavior applies to the reordered draft. The control is
disabled for fewer than two items.

Verification: 157 relevant Vitest tests passed across dice, shared editors,
Zoneless panels, compact launchers, and sidebar tabs. Chrome verified passive
stale references and selection/scrolling with 100+ Zoneless Actors in canvas,
stacked sidebar, tabbed sidebar, and compact drawer layouts.

### Log reference viewport navigation and settings

Share current-geometry viewport navigation between Status Actor images and Log
references. Accepted Actor selections pan to their derived rendered placement;
Zones pan to their polygon centroid. Use the existing Motion pan behavior without
changing zoom or encounter history. Respect active-tool restrictions and retain
Zoneless panel reveal for off-canvas Actors; spatial Actors outside Zones still
navigate to their canvas placement.

Interface → Log replaces the Chat section. Its Colors subsection contains Sender
name color and Match message text to sender name color. Reference navigation has
one switch, Move viewport to selected references, enabled by default. Disabling
it suppresses only canvas panning initiated from Log references. Selection,
previews, Zoneless reveal, and Status image navigation continue to work. Store
`logPanOnSelection` with existing browser interface preferences, validate/default
older or malformed values, synchronize storage changes, and include it in the
Interface reset category.

Verification: 157 relevant tests passed across reference navigation, stale and
Zoneless references, Status, and settings. Root/API/functions typechecks passed.
Chrome at 1440px and 390px verified Actor and Zone panning on a zoomed-in canvas
with zoom preserved. A fit-to-canvas view correctly has no additional scroll
range. Focused tests verify the switch's immediate effect, persistence/defaults,
Interface reset, and independent Status image navigation.

### Panel settings section organization

Keep Panels focused on shared panel tabs, default layout, and visibility. Promote
Initiative, Status, and Zoneless from its subsections to separate Interface
sections, alongside Log. Immediately after Panels, order these sections
alphabetically: Initiative, Log, Status, Zoneless. Existing preference controls,
persistence, and reset behavior remain the same.

Initiative, Log, Status, and Zoneless section headings each append “(Panel)” in
muted, regular-weight text to identify these as panel-specific settings.

### Reusable configurable editing flow

All configurable editors share the same shell behavior: a divider below their
selection controls, dirty-item pencil icons in the dropdown, and draft-aware
discard confirmation. Escape from a dirty editor confirms any unsaved change;
Cancel confirms only when multiple items are dirty. Continue editing sits at the
bottom left; Discard changes sits at the bottom right and receives initial focus.
Confirmation dismissal preserves the draft and restores editor focus. An open
selector consumes Escape first. Added/deleted items and reordering count as draft
changes; automatic index shifts do not dirty untouched neighbors.

Counters and Clocks now use their Edit dialog for both add and edit, like
Rollables. Add starts with a new draft selected. Both Add and dropdown Create new
focus Name immediately. Empty editors show Create new directly, with no empty
selector or sort button. Empty Rollables show “No rollables yet. Choose Create new
rollable to add one.” The Name-field spacing matches Counters and Clocks.

The shared shell owns close policy, confirmation, divider, and create focus. Each
configurable supplies fields, validation, selection, and dirty-item metadata.
Counter/Clock drafts retain bounds, generated names, resource mappings, styles,
atomic saves, and undo/redo. Single-new-counter saves still resolve automatic name
conflicts at commit time.

Verification: the broad controls/panels run covered 448 tests; 447 passed and one
unrelated panel-layout test hit its five-second timeout under parallel load.
That panel suite and final configurable checks passed on rerun with a ten-second
limit (58 tests). Root/API/functions typechecks passed. Chrome at 1440px and 390px
verified all three editor types, including encounter Clocks: dirty indicators,
Escape/Cancel rules, initial Discard focus, creation Name focus, empty-list direct
creation, and preserved drafts. Final screenshots confirmed consistent field
spacing after removing Clock style padding and aligning label/control spacing.

### Stale reference warning interaction

Superseding the earlier passive-reference behavior, stale Actor/Zone references
retain hover and keyboard affordances. Clicking or keyboard activation only
shows a warning-styled “Stale reference” tooltip beneath the reference. Hover
and focus alone never show this warning. Escape, blur, or an outside pointer
interaction dismisses it. Selection, canvas outlines, viewport, and encounter
history remain unchanged. Restoring the entity removes the stale warning and
restores normal navigation. Reuse the existing tooltip portal/positioning with
optional bottom placement and warning appearance.

Verification: 22 relevant tests and root/API/functions typechecks passed,
including click-only visibility, keyboard activation, dismissal, restoration,
and unchanged selection/viewport behavior.
Chrome at desktop and compact widths confirmed warning placement below the
reference, hover suppression, Escape dismissal, and unchanged selection.

### Consistent completion for all Log suggestions

Apply the entity-reference completion flow to every suggestion kind, including
Actor Rollables after `/` and slash commands. Highlight the first match immediately
and preview the remaining prefix-matched text at the end of the draft without
changing its value. Tab, Enter, or Space accepts the match without sending.
Commands retain their leading slash and trailing argument space; Rollables retain
the existing quoting rules. Substring matches remain selectable without a suffix.
Keep shared Escape dismissal, pointer selection, saved-caret keyboard navigation,
and Actor outline previews.

Verification: 44 relevant Log/dice tests and root/API/functions typechecks passed,
covering immediate acceptance without sending, prefix versus substring completion,
quoted Rollables, dismissal, and keyboard navigation with typing restoration.

### Stable inline completion while editing

Render the composer and completion from the same suggestion state so each commit
pairs the current draft with its remaining suffix. Remove the effect-driven
suffix copy in the composer. Memoize suggestion lookup for unrelated renders.
Retain the current suggestion within the same reference scope while its name
still matches the edited prefix; recompute the best match when invalidated.
Typing after keyboard navigation restores the text caret without briefly clearing
the selected match. Explicit navigation, dismissal, and scope changes still work.

Verification: 48 relevant Log/dice tests and root/API/functions typechecks passed.
Regression coverage checks every React commit for synchronized prefix/suffix text
and retained Actor, Rollable, and command matches. Chrome at 1440px and 390px
confirmed consistent painted previews while repeatedly typing/deleting, plus
retained command selection and completion.

### Spaces while refining quoted multiword names

When any matching suggestion is multiword, an opening single or double quote makes
Space literal text rather than accepting the current match, including when the
highlighted suggestion is single-word. This lets shared first
words be refined through subsequent words, including after keyboard navigation.
Tab, Enter, and clicking remain explicit acceptance controls. Unquoted references
and quoted references with only single-word matches keep Space acceptance. Preserve manually typed quote
style and resolve single-quoted Actor/Zone/Rollable references consistently,
including escaped quotes and separators inside quoted names. Apostrophes within
unquoted names remain literal.

Verification: all 241 dice UI/core tests and root/API/functions typechecks passed.
Chrome at desktop and compact widths verified literal quoted spaces, refinement
to a later word, preserved single/double quote styles, and unquoted completion.

Follow-up verification: 46 completion tests and root/API/functions typechecks
passed with single-word matches highlighted alongside multiword alternatives,
covering both quote styles for Actors, scoped Actors, Zones, and Rollables.

### Initial check result focus

Use the shared dialog's initial-focus marker on the first Success button when
opening or reopening Check result/Check results. Enter activates the native button;
single-target success resolves immediately through the existing effect roll flow.
Multi-target dialogs initially focus the first target's Success control.

Verification: 28 check-mode and dice chat tests passed, covering initial focus,
reopening shared/per-target dialogs, and Enter resolving a single-target success.

### Label subtotal tooltip

The proposed label/formula relocation was withdrawn. Keep existing formula and
result label rendering. When a saved result has at least one label and either
another label or an unlabeled portion, hovering/focusing Total shows a tooltip
below it. Aggregate repeated labels and show unlabeled values as Other. Omit
breakdowns for unlabeled-only or entirely single-label results. Touch-hold exposes
the same summary.

After reviewing examples, the user chose contributions to the final total.
Apply addition/subtraction and distribute scalar multiplication/division across
labels; multipliers/divisors do not become Other summands. Split inseparable
mixed-label operations and rounding proportionally by contribution magnitude,
with the residual in the last entry. Parent labels own their whole expression.
Derive from saved kept-pool values, excluding dropped/rerolled
faces, auxiliary rule calculations, and computed count/sides. No saved schema or
roll execution changes are needed.

Verification: all 272 dice UI/core tests and root/API/functions typechecks passed.
Coverage includes repeated labels, Other, tooltip visibility/dismissal, kept/dropped
pools, scalar arithmetic, proportional mixed-label operations/rounding, and totals
remaining fully accounted for. Chrome at desktop and compact widths confirmed the
tooltip sits below Total and `(2[Fire]+3[Cold])*2` shows Fire: 4 and Cold: 6.

The subtotal tooltip follows the active light/dark panel background, text, and
border colors, including delegated touch-hold help. Other tooltip appearances
retain their existing defaults.
Verification: 19 relevant tooltip tests and root/API/functions typechecks passed;
desktop/compact screenshots confirmed the panel palette in light and dark themes.

### Copyable notation examples

Use `2d6[Physical] + 1d6[Magic]` for the Labels example. Every notation-guide card
has an accessible copy icon at the top right, with desktop/touch help. Copy only
the exact example formula. Show successful copy feedback and an inline error with
retry support if clipboard access fails.

Verification: 34 settings/notation tests and root/API/functions typechecks passed,
including copying every example, clipboard failure/retry, and executing the guide.

### Log message recall

Up from the draft's first visual line starts sent-message recall; Up/Down then
navigates immediately until the oldest entry or the original draft. Suggestions
take priority. Only the current user's sent messages are eligible. Skip explicit
line breaks (Shift+Enter), retain visually wrapped single-line messages, and
deduplicate exact message text by keeping its most recent occurrence.

Preserve the original draft's caret and reference bindings and retain edited
versions of recalled messages while browsing. Reuse saved reference identities
for duplicate-name disambiguation. Sending publishes a new card through the normal
flow and resets recall. Recalled edits never change sent cards or Redux history.
Keep this behavior in a focused hook; use owner-document text measurement to
distinguish visual textarea lines on compact and desktop layouts.

Verification: 46 relevant Log/completion tests and root/API/functions typechecks
passed. Chrome at 1440px and 390px verified first-visual-line entry, skipping
multiline/duplicate/other-sender messages, retained recalled edits, exact draft and
caret restoration, and suggestion priority.

### Accessible dark-theme Actor reference colors

Render automatic saved faction colors with lighter dark-theme variants for live
and stale Actor references. Keep historical saved colors, light-theme behavior,
Zone colors, and selection/preview interactions intact. All four dark variants
meet WCAG AA normal-text contrast against the actual Log card surface (#343438).

Verification: 22 relevant tests and root/API/functions typechecks passed. Chrome
at 1440px and 390px measured contrast ratios of 4.88:1 (Hero), 7.11:1 (Ally),
6.53:1 (Enemy), and 8.09:1 (Neutral). The user subsequently requested a darker enemy
red; the final `#f87575` remains AA compliant at approximately 4.60:1.

### Scoped reference trees and recall suggestion suppression

Message recall suppresses suggestions and inline completion through repeated
Up/Down navigation, until typing/deletion changes the draft again. Outside recall,
retain normal suggestion keyboard priority.

Resolve reference paths through Zone/faction/Actor scopes, with flat selector lists
at every level. Examples: `@Zone1.heroes.Actor1` and
`@[Zone1,Zone2].[heroes,enemies].["Hero One","Enemy One"]`. Each selector operates
on the union of its parents' children. Completion filters against that scope and
stops after Actor leaves. Scoped Rollable sources must identify exactly one Actor;
invalid/out-of-scope entries block the entire roll. Deduplicate overlapping targets.
Preserve explicit duplicate-name choices with per-item keys and ordinary saved
entity spans; no durable schema changes or duplicated membership state are needed.

Union faction selectors preview all matching current Actors and select them when
the current tool permits it. Actual Zone/Actor tokens keep their individual
historical identities, colors, and interaction. Use saved parent identities through
renames; missing parents cannot redirect to a new same-named entity. When Log
navigation is enabled, pan the union only if all selected Actors have canvas
placements and their complete token bounds fit at the current zoom. Otherwise keep
the viewport unchanged. Never zoom to fit a union.

Verification: the broad dice/core/group-navigation run passed all 314 tests; final
targeted checks passed 26 tests, including stale union parents, recall suppression,
and scoped repository/cloud-validation round trips. Settings/recall/union checks
also passed (18 tests). Root/API/functions typechecks passed. Chrome at 1440px and
390px verified scoped completion, Actor leaves, nested target lists, union hover
and selection, invalid-entry blocking, and recall suppression. Rendered contrast
checks confirmed the final darker enemy red remains above 4.5:1.

### Direct faction references and consistent faction selection

Use the same Actor-group interaction for ordinary `@Zone.heroes`, faction list
items, cross-Zone unions, and direct faction roots. A faction click selects matching
Actors rather than the Zone represented by its historical display span. Preserve
existing scoped reference colors, tool restrictions, stale warnings, and the
current-zoom group navigation rule.

Offer direct `@heroes`, `@allies`, `@enemies`, and `@neutrals` references when their
factions are populated. Resolve direct scope over the entire encounter, including
Zoneless Actors. Support direct faction lists and Actor refinement, such as
`@[heroes,enemies]` and `@heroes.ActorName`. A source still must identify one Actor.
Reveal the first selected Zoneless member when needed. Derive global faction
membership from Actor layout groups and use existing message syntax and entity
snapshots, without introducing new persisted relationships or a schema change.
Apply the existing root-reference ambiguity rule when a faction shares its name
with an Actor/Zone: require a choice and preserve it on recall and replay. Quoted
names denote entities; direct faction roots retain their stable virtual identity.

Verification: all 327 dice/settings/navigation tests and root/API/functions
typechecks passed. Coverage includes scoped faction clicks, direct roots/lists,
global Actor refinement, Zoneless reveal, and explicit faction/entity choices
retained on replay. Chrome at 1440px and 390px confirmed ordinary Zone-faction
references select Actors and direct factions support suggestions, hover, selection,
and roll targeting.

### Reference selection from every tool

Fix silent rejection of Actor/faction clicks while the default Zone tool is active.
Reference clicks now use one shared selection flow that follows existing panel
selection behavior: retain a compatible tool, switch an incompatible tool to
Select, or update Audio's Actor/Zone owner section. Then select the live referenced
entities through the normal guarded interaction action. Stale/empty references
must not change either selection or tool.

Keep existing viewport preferences, fit-at-current-zoom group navigation, and
Zoneless reveal behavior. Tool changes and selection remain session-only and
leave EncounterState/undo history unchanged. This supersedes the earlier Log
behavior that silently ignored references rejected by the active tool.

Verification: 38 relevant tests and root/API/functions typechecks passed, including
selection from all nine tools and stale-reference protection. Chrome reproduced
the original failure with Zone active, then verified actor and faction clicks from
that same tool on desktop and compact layouts.

### Single-click selection and double-click navigation

Remove the Log navigation setting from the settings UI, preference type/defaults,
provider actions, decoder, and Interface reset keys. Ignore obsolete stored values.
Keep Reference navigation as short interaction guidance rather than a switch.

Single-click (or native keyboard activation) selects the referenced
entity/actors without navigation. Double-click selects and navigates: pan to a
canvas entity preserving zoom, or open/scroll Zoneless to the selected actor.
Faction groups retain the fit-at-current-zoom condition; oversized groups do not
pan or zoom. Native double-click sequences navigate once. Pointer selection uses
the existing 250 ms gesture window because Properties expansion otherwise moves
the Log reference between clicks; keyboard activation stays immediate. Cancel
pending clicks on unmount or encounter-session changes. Stale references stay
warning-only, and existing tool adaptation stays
intact. Status image clicks retain their independent navigation behavior.

Verification: the broad dice/settings run passed 203 tests; final gesture-lifetime
and navigation checks passed 23 tests. Root/API/functions typechecks passed. Chrome
at 1440px and 390px verified selection-only single clicks, double-click navigation
from the Zone tool, preserved zoom, stationary oversized groups, and ignored legacy
preference values. Updated stale Settings category queries to the existing Panel
section titles while checking preference removal.

### Compact unquoted reference suggestions

Compare unquoted reference fragments against names with whitespace removed, at
every scoped selector and Actor Rollable completion. Preserve prefix-first
ranking and the current suggestion while its compact prefix remains valid. Map
the remaining inline suffix to the original name's character positions so spaces
do not duplicate or skip letters. Accepting still inserts the real name with
required quotes. Quoted fragments and sent reference resolution remain strict;
`@hero1` can suggest `Hero 1` but cannot resolve it without accepting the
completion. No persisted state or encounter-history behavior changes.

Verification: 40 relevant tests passed, covering compact ranking, scoped/list
completion, Rollables, strict resolution, quoted matching, and stable previews.
