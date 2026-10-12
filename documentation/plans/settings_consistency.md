# Settings consistency guide

## Goal and hierarchy

All Settings tabs use Category → Section → optional Subsection → Setting.
Categories use one title and a short summary. Sections are subtle bordered cards;
subsections have smaller headings and inset content, without competing nested
cards. Setting labels are subordinate to headings. Place setting-specific help
beside its label and group-wide help under the group heading.

Use shared category, section, subsection, row, and field presentation components
in `src/ui/settings`. Keep state and behavior in the existing providers.
Use consistent widths, spacing, control sizes, keyboard focus, enabled hover,
disabled appearance, and field errors. Stack ordinary rows on compact screens;
align labels and controls on desktop. Sliders occupy their own full-width rows
and show the current value, with grab/grabbing cursors. Complex controls such as
panel order use dedicated full-width rows. Icon controls use desktop hover and
touch-hold tooltips. All animation uses Motion.

## Categories and section order

- **Audio:** Playback (master volume, media-key scope); Cue defaults (volume,
  Ambience classification with type/threshold, Repetition with music repeat,
  looping, and Effect delay range).
- **Canvas:** New encounter defaults (creation tool, Placement, Zone appearance);
  Navigation (right-click panning only); Background (resize overflow);
  Zone membership (method, conditional fallback, Decision priority);
  Cell Tracer (invalid routes); Isometric tokens (projection).
- **Combat:** Movement (destination warning, held repeat delay); Health (counter
  name, HP limits, keep heal/damage dialog open, Automatic health status with
  units, cutoffs, and validation).
- **Interface:** Appearance (theme); Accessibility (animations); Library
  (Behavior and views, Card sizes); Panels (Visibility, Default layout,
  Initiative, Status). Initiative contains auto-select and dead-name
  strikethrough. Status contains conditions/equipment visibility and default
  clock style for clocks created through the Status panel.
- **Keybinds:** Viewport panning (directions/presets); Customizable shortcuts;
  Fixed shortcuts. Reset defaults remains an explicit category action.
- **Account:** Cloud sync (status, identity, usage, Drive connection, actions,
  last sync, errors). Explain device storage, backup, and sync in user language.
- **Data:** Asset storage (image compression); Workspace backups (export/import);
  Reset local data (last, with destructive styling and existing confirmation).

Library size sliders remain alphabetical: Audio, Background, Character and
Token, Encounter. Panel visibility lists remain alphabetical. Preserve semantic
orders for directions, cutoffs, dependencies, and priority lists.

## Session navigation

Label the main category group Workspace; keep Account and Data in their lower
group. Remember the selected category and each category’s scroll position when
Settings is closed and reopened in the active application session. Keep this
state in memory; do not write it to local storage or workspace records. A refresh
starts a fresh navigation session.

## Saving, scope, and compatibility

Preserve current save timing, validation, defaults, and storage keys. Immediate
controls remain immediate. Blur-saving fields retain blur and existing Enter
handling, with explicit nearby help. Explain whether a preference affects new
encounters, new assets/clocks, this device, or the current encounter.
Applying panel order to the current encounter remains a separate action.
Preserve undo/redo, writer restrictions, shortcut conflicts, reset confirmation,
and last-valid-value behavior. Category relocation needs no migration.

## Validation and implementation workflow

Verify each setting appears once in its assigned category and group. Test group
semantics, accessible labels/descriptions/errors, dependencies, persistence,
reload, cross-tab synchronization, and reset. Retain history/recalculation,
layout application, shortcut conflict, and import/reset coverage.
Run relevant Vitest tests with `--reporter=agent` and TypeScript checks.
Review every tab in Chrome at compact/desktop widths and in light/dark themes,
including keyboard navigation and touch help. Do not assert CSS styling in tests.
Preserve existing staged work; leave this implementation unstaged.
