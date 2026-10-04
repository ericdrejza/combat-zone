# Audio Support Plan

## Goal

Add encounter-scoped audio assets, reusable cue groups, automatic Effects,
playlist-style Music groups, and a responsive Soundboard without persisting
runtime playback state.

## Product model

- Audio is a primary toolbar tool with the `M` shortcut. Clicking the active
  tool returns to Select.
- The Audio workspace always exposes Encounter, Zones, and Actors.
- Encounter contains Ambience and Music subsections. Both contain only named,
  user-created groups; a fresh encounter has no fixed or synthetic groups.
  Music cue order is playlist order.
- Zone and Actor sections contain reusable groups. An entity may inherit
  multiple groups from its own section; groups do not cross entity sections.
- Groups own configuration. Entities store only ordered group references, and
  selectors derive cues and inheritors without duplicating either relationship.
- Audio cues have two types selected with icon radio buttons: Track and Effect.
  Zone and Actor groups accept Effects only; Music groups accept Tracks only.
  Ambience accepts either type.
- Track describes position-oriented playback with seeking and resumable timing;
  Effect describes event-oriented playback normally heard from start to finish.
  Tracks are often longer, but duration does not determine or constrain the type.
  Repetition is a separate behavior, not a cue type.
- Repeat is independent from cue type. A Track with Repeat enabled loops continuously.
  A repeating Effect waits a random duration between its configured minimum and
  maximum before playing again. Allowed delay choices are `0s`, `1s`, `2s`,
  `5s`, `10s`, `15s`, `20s`, `30s`, `45s`, `1m`, `2m`, `5m`, `10m`,
  `15m`, `20m`, and `30m`.
- The entire Music section permits only one active cue at a time. Starting a
  track stops any active track in another Music group. An info tooltip explains
  this section-wide limit. With group Repeat enabled, finishing a non-repeating
  cue advances to the next cue and the final cue wraps to the first. With group
  Repeat disabled, the current track finishes without advancing. Toggling this
  setting during playback takes effect at the current track's end.
- Master volume and new-cue defaults are interface preferences. Cue and group
  configuration is durable Encounter state. Playback position, timers, paused
  state, disclosure state, and audio elements are session-only.
- Settings includes a new-cue volume preference (initially 50%, including 0%).
  Default Effect replay delays start at 0s–0s and use the same allowed choices as cue repeat
  controls, phrased as “By default, repeated effects will repeat their sound
  every {minimum} to {maximum}”.

## Library

- Audio is a root Library section included in persistence, import, export, and
  cloud serialization.
- Accept MP3, AAC/M4A, Opus/Ogg, FLAC, and WAV, validating declared format and
  browser decodability before storage.
- Audio uses the existing folder, link, local-asset, conflict, and import/export
  infrastructure.
- The Audio Library tab can preview audio. Its headphones `Preview audio`
  toggle is independent from the visual asset preview toggle and retains its
  own state while navigating tabs. Visual Library tabs use a Play icon for
  `Play animated assets`; Audio uses the Headphones icon.
- Audio previews work in grid and list views; the player omits playback speed.
  Audio previews follow selection only, never hover or touch-hold. Visual
  previews retain hover and touch-hold behavior.
  Grid previews sit in the modal footer to the left of Add Cue, with a gap
  between the controls. Switching grid/list relocates the same media player
  without restarting playback. Cards themselves have no transport buttons.
  Audio cards default to AudioLines instead of an image placeholder. Their
  context menu toggles between Audio and Music icons. The optional icon
  preference belongs to the original asset and is shared by all its links.
- Activating Audio opens the docked Library to Audio. Each group ends with an
  Add Cue card shell containing a plus. Selecting it opens the full Library
  above the Soundboard and locks the Library to its Audio tab.

## Persisted state

Keep audio normalized in `EncounterState`:

- `audioCues` is a normalized, ordered collection. A cue contains its stable
  ID, Audio Library node ID, placement, Track/Effect type, volume, repeat flag,
  Effect repeat-delay range, movement-trigger selections, and their enabled state. Cue volume
  defaults to 50% and is constrained to 0–100%. `allIds` determines order
  within each filtered group.
- Every cue placement references a normalized group ID. Cue membership is
  derived from placement.
- `audioCueGroups` contains named Ambience, Music, Zone, and Actor groups. A
  group contains a stable ID, section, editable name, and Music playlist-repeat
  flag. Do not store reverse cue IDs or inheritor IDs.
- Encounter owns ordered Music group IDs. Zones and Actors own ordered
  `audioGroupIds`.
- Library bytes and metadata remain in the Library and are resolved by ID.

Validate collection integrity, cue placement, section/type compatibility,
repeat-delay ranges, trigger legality, group references, and Music
order before data reaches Redux. Schema 11 uses `track` and `effect` as the only
current cue-type values. This naming refactor targets fresh application data;
older cue-type names are not migrated or accepted as aliases. Existing unrelated
migrations remain in place, including trigger-enabled state normalization.
The earlier schema-8 audio model is development-only and unsupported; use fresh
browser data rather than migrating it. Pre-audio schema migrations remain supported.

Deleting a Zone or Actor leaves reusable groups intact. Deleting a named group
is available only in Soundboard, requires confirmation, removes its cues, and
unassigns it from every inheriting entity in one undoable mutation. Missing
Library assets remain visible so their cues can be removed or relinked. All cue/group creation,
editing, movement, deletion, assignment, and ordering participates in history.

## Assignment and Properties

- Adding an Audio Library item always requires a destination. Encounter offers
  existing or new Ambience and Music groups for Tracks, and only Ambience
  groups for Effects. Normal Library browsing closes the Library before opening
  the destination picker; a group-specific Add Cue action adds directly to
  that group. Zone or Actor additions use groups
  assigned to the selected entity.
- When multiple destinations are legal, show cards with group and cue names.
  A new-group option for each compatible section creates, assigns when needed,
  and adds the cue as one undoable action.
  Choosing that option first opens a naming dialog with Back and Create.
  Back returns to destination choices without mutations. Create uses the
  trimmed entered name, or the displayed default placeholder when left blank.
- Group membership for Zones and Actors is edited only in Properties.
  Properties shows the selected entity's name and its current group selection.
- Audio/Status does not create groups, delete groups, or edit entity membership.
- Undo, redo, encounter loading, and non-movement selection do not emit audio
  triggers.

## Cue behavior

### Track

- Available in named Ambience and Music groups.
- Position matters: users can scrub to hear a particular passage or resume where
  playback paused. A Track need not repeat.
- Plays immediately. Repeat on loops continuously; Repeat off finishes once.
- Cards show elapsed time left of the scrub bar and total duration right of it.
- Global Pause preserves position; global Play resumes it.

### Effect

- Available in named Ambience, Zone, and Actor groups.
- Event-oriented sounds are normally heard from start to finish rather than
  navigated with a scrub bar; Effects still display their total duration.
- Repeat off plays once. Repeat on shows the compact `Repeat this sound every
  [minimum] to [maximum]` controls and schedules another playback after each
  completion.
- Turning Repeat off cancels any pending wait, including a paused wait. A sound
  already playing may finish, then stops without scheduling another playback.
- Cards show total duration beside the Effect type text, separated by a dot.
- Zone Effects independently offer `Entering zone` and `Leaving zone` trigger
  choices. Actor Effects independently offer `Actor enters zone` and `Actor
  leaves zone`. Choices appear side by side when card width permits.
  Zone and Actor cards place a Flag toggle beside Repeat. Repeat and Flag are
  mutually exclusive, and toggling the selected behavior off permits neither.
  Repeat shows replay-delay settings; Flag shows movement-trigger settings.
  Inactive repeat delays and trigger selections remain persisted for reuse,
  but inactive triggers never fire or show active movement indicators.
  Enabled triggers also appear beside the cue's duration in Soundboard and
  docked cards: MoveLeft indicates entering, and MoveRight indicates leaving.
- One move may emit several triggers. Playback requests are ordered as Zone
  leaving, Actor leaving, Zone entering, then Actor entering. Within one move,
  all cues referencing the same Library asset (including links) share one sound
  at the highest participating cue volume. Every participating card shows its
  playing state and progress; completion clears them together. Stop on any
  participating card stops that shared sound and all its participating cards,
  without stopping unrelated assets. Later movement batches remain independent
  and may overlap earlier playback. Manually started cues are not deduplicated.
- Global Pause rewinds non-repeating Effects. It pauses repeating Effects and
  preserves their remaining wait. Global Play resumes only retained playback.

## Audio panel and Soundboard

- The docked Audio panel follows global visibility and docking preferences. It
  shows resolved cues for the current scope. With no relevant selection it
  shows Encounter, Zones, and Actors; a selected Zone or Actor filters to that
  entity's assigned groups.
- The panel header places Soundboard and active-state Volume buttons to the left
  of the panel drag handle. Master and cue volume controls appear only while
  Volume is active, and slider history/preferences commit only on release.
- Docked cue cards show their type and, only when repeat is enabled, a read-only
  Repeat1 icon beside the Track type text or at the bottom left for Effects. Effects show the tooltip `This sound repeats
  every {min} to {max}` with their configured delay range; Tracks show
  `Repeating`. Their Play/Stop control sits at the top right.
- Cue cards are compact. Soundboard cards have a borderless drag handle and can
  use three columns at large screen sizes and four at extra-large sizes. They
  move within or between every section. Moving into Music converts a cue to a
  Track; moving into Zone or Actor converts it to an Effect; Ambience preserves
  its type. Invalid destination triggers are cleared. Music playlist playback
  follows cue order.
- Groups have a borderless drag handle immediately left of their borderless
  disclosure control. Groups can reorder or move across sections; moving one
  normalizes all contained cues and clears now-invalid entity assignments.
- Cue and group drag targets show a theme-contrasting insertion line. Dragging
  a cue over the left half of another card inserts before it with a vertical
  marker on the left; the right half inserts after it with a vertical marker
  on the right. Groups use horizontal markers: the upper half inserts before
  the target group and the lower half inserts after it, including drops over
  cues inside that group. Reordered groups animate as whole units, including
  their headers and cue cards, with a short smooth layout transition.
  Dragging near the Soundboard's top or bottom edge scrolls it
  while more content exists.
- Focusing a group-name input selects its entire name. Pressing Enter commits
  the edit and blurs the input. Neither Soundboard nor docked Music cards display
  playlist indices.
- Soundboard owns named group creation in Ambience, Music, Zones, and Actors,
  and owns confirmed group deletion. Each section reserves a bottom row for an
  `Add new group` control that becomes visible on section hover without changing
  layout size.
- The Add Cue card matches cue cards sharing its row; alone in a new row it
  uses its smaller default height. Add new group has a visible hover style. Music group
  Repeat controls use the standard Repeat icon.
- Cue and group trash controls are borderless, red, and shown only on hover or
  keyboard focus.
- Each top-level section, Encounter subsection, and group has a top-right
  borderless expand/collapse icon.
  Collapsed Soundboard groups show a cue-count bubble. Docked panel sections
  and Encounter subsections also collapse; docked groups do not. Music group
  movement uses MoveUp/MoveDown controls, dimmed and disabled at order boundaries.
  Music section headers have an independent Music-only Play/Pause control
  immediately to the left of their info tooltip.
  Soundboard and docked Audio panel Ambience, Zones, and Actors headers have independent section
  Play/Pause controls too. Encounter controls both Ambience and Music without
  affecting Zones or Actors. A paused section also queues newly selected cues
  until it resumes; global Resume clears every section's pause.
  Soundboard scrolls vertically while its transport header remains sticky.
- Soundboard uses the application light/dark theme.

The Soundboard launcher first opens an extra-large in-app modal. Clicking the
backdrop closes it. Its `square-arrow-out-top-right` button moves the same live
Soundboard into a named popup window; the popup uses
`square-arrow-out-bottom-left` to close itself and dock back into the modal.
Both launchers show an active state while either presentation is open. Browser
chrome such as the download affordance or address header is not application-
controlled; request minimal popup chrome where browser policy allows it.
The Audio Library modal uses a higher overlay layer than the Soundboard modal,
so it remains visible and interactive when launched from a cue shell.

Cue volume is controlled through a Volume icon rather than a persistent
horizontal slider. Clicking it opens a vertical 10%-step slider with a grab
cursor. Clicking outside or blurring the slider closes it. The minimum is
0%; muted cues use a red Volume Off icon, below 30% uses Volume, 30–70% uses
Volume 1, and above 70% uses Volume 2. Active cues have a blue border, including
repeating Effects waiting for their next playback.
Paused retained or queued cues have a yellow border; idle cues do not.
Hovering the Volume icon shows the cue's volume percentage until the pointer
leaves or the volume slider opens.
The value commits to history when the slider is released. Cue controls place
the Repeat icon beside the type choices with a separator and place Play at the trailing
control position. Cue Repeat uses `repeat-1`; Music group Repeat keeps `repeat`.

The docked transport uses equal compact spacing above and below its controls.
Audio Properties group ordering uses the same MoveUp/MoveDown icons as the Audio panel.
Audio Properties also has an active-state Soundboard launcher at its heading,
including when showing the Encounter or selection guidance.
Launching from a selected Actor or Zone expands its section and assigned groups,
then scrolls its first assigned group below the sticky transport header. An entity
with no assigned groups opens its section instead. This also works when the
Soundboard is already open or popped out and does not change encounter history.

The sticky transport header centers rewind, global Stop, one Play/Pause button,
and forward controls. Master volume, current playback state, and the pop-out/pop-in
control sit to the right. The docked panel has the same transport above Encounter:

- Rewind and forward navigate the active Music track only; they do not affect
  Ambience or Effects. Both use the same previous/next rules as the media keys.
- Stop rewinds every cue, clears repeat timers, and clears global pause.
- Pause rewinds non-repeating Effects and pauses Tracks/repeating Effects,
  including active waits.
- Selecting Play on a cue while paused queues it without starting audio. Resume
  starts queued cues and playback retained by Pause, and never starts idle cues.
- Audio subtools also provide global Stop, Pause, and Play.
- Loading another encounter stops and resets playback.

## Settings

Audio settings contain master volume, default volume for added cues, and default
minimum/maximum Effect repeat delays chosen from the same options as the
Soundboard repeat controls. Store these in the existing namespaced
interface preferences and restore them with application preference reset.
There is no default cue-type preference or setting. Normal Library additions
start as Tracks; audio-tool additions use the currently selected cue type.
Direct group additions use Tracks for Ambience/Music and Effects for Zone/Actor.
Section/type restrictions remain unchanged.
Keyboard Play/Pause controls have an Audio setting for `All sounds`
or `Music only` (default). Music-only pause/resume leaves other sounds running. Keyboard
controls use browser Media Session actions where supported and handle delivered
media-key events even when native support exists. Duplicate native/keyboard
delivery is handled once. The active Music track remains the transport target
after selecting a non-Music cue; both routes update the same playback state as the UI.
Previous restarts the active Music track when more than 3 seconds have elapsed;
otherwise it selects the previous track in that group. At the first track it
wraps to the last when group Repeat is on, or restarts the first when off.
Next selects the next track in the group, wrapping when Repeat is on and
stopping after the last track when off. Track navigation while paused queues
the selected track for resume.

## Verification

- Domain/history tests cover cue/group mutations, Music repeat, cross-section
  movement and normalization, assignment, deletion cascades, order, undo, and
  redo.
- Playback tests cover volume, repeat behavior, Effect delay preservation,
  stop/pause/resume, independent automatic instances, Music exclusivity,
  playlist advancement, and playlist wrapping.
- Persistence tests cover invalid references, types, placements, delay ranges,
  round trips, imports, and local assets.
- UI tests cover destination choice, the locked Audio Library flow, preview
  state, duration/progress displays, repeat/volume/trigger controls, Add Cue
  shells, hover group creation/deletion, drag insertion previews and automatic
  scrolling, Enter blur, disclosure controls, theme synchronization, overlay
  ordering, modal backdrop close, popup/dock behavior, and global transport.
- `npm run typecheck` and `npm run test:agent` must pass before completion.
