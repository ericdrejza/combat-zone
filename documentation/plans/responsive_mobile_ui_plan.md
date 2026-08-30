<proposed_plan>
# Responsive Mobile and Touch UI

## Summary

Make Combat Zone usable from the existing 320px minimum through desktop
widths while preserving EncounterState, interaction contracts, and Redux
history. Desktop keeps the existing docked workspace. Below the `lg`
breakpoint (1024px), the toolbar becomes compact, active-tool options move to
a secondary strip, and panels are accessed through a bottom-right launcher and
single-panel drawer.

## Toolbar and viewport behavior

- Centralize Lucide icons for Library, Background, Zone, Edge, Annotation,
  Actor, and Select. At `lg` and wider, primary controls show icon plus text;
  below `lg`, controls show icons only while retaining ARIA names, title
  tooltips, and keyboard shortcuts semantically.
- Compact toolbar controls and subtools use 44px minimum hit targets. Primary
  controls and the active subtool strip scroll horizontally when width is
  insufficient. Keybind labels are hidden in compact mode; zoom percentage is
  always retained.
- Background, Zone, Edge, and Actor options remain the same controls and Redux
  actions. Desktop renders active options inline; compact mode renders the
  active options once in a dedicated horizontal bar below the toolbar row.
- Zoom is a compact utility toolbar item that never changes the active edit
  tool. Desktop renders it at the right edge and allows it to collapse/expand;
  compact mode keeps the percentage and icon controls available.
- A stationary 500ms touch hold on any tooltip-bearing element shows its
  tooltip without activating the control. Mouse pointers continue to use
  hover and never enter the touch-hold path. Touch selection supports the same
  selection toggle behavior as mouse input. Touch holds anywhere in the app do
  not invoke browser or application right-click context actions; mouse
  right-click remains available while testing at a compact viewport width.
- Touch canvas gestures have full parity: one-finger editing/selection and
  two-finger pan/pinch navigation, with existing right-drag desktop panning
  preserved.
- A compact bottom-left Delete control appears for a non-empty Zone, Edge, or
  Actor selection only while its matching entity tool is active. It reuses the
  keyboard deletion workflow, including selection clearing, history, and
  entity-specific cascading effects.
- At compact widths, Encounter rename remains in its normal far-left toolbar
  position as an icon-only pencil control. A touch hold shows the current
  Encounter name, and activation uses the same state/history behavior as
  desktop.

## Mobile panels and launcher

- At compact widths, replace the desktop side docks with a fixed bottom-right
  panel launcher and one scrollable drawer. The launcher defaults to Library.
- The canonical launcher target order is:
  `Log → Library → Zoneless → Properties → Status → Initiative`.
- The launcher icon always represents the last selected launcher target.
- A short tap opens the current launcher target’s drawer. Holding the launcher
  for 500ms opens a persistent vertical target menu. Releasing leaves the menu
  open without closing an open panel; tapping outside closes only the menu.
  Tapping a target selects it and closes the menu. An open panel replaces its
  content in place, while a closed panel remains closed until the next short
  launcher tap. Panel opening and closing has no horizontal travel animation.
- The launcher also remains available on coarse-pointer, no-hover touch devices
  whose desktop-site mode reports a viewport at or above 1024px.
- Menu target selection works with touch, mouse, and keyboard equivalents.
  Escape and outside interaction dismiss transient menu/drawer state without
  changing EncounterState.
- Only one drawer is open at a time. Selecting another target replaces the
  target state but does not implicitly open its drawer after a long-press
  selection.
- Library and Zoneless drawer interactions auto-close the drawer when a drag
  begins and allow the drag to continue onto the canvas. Existing drag/drop
  payloads, selection, and history semantics are unchanged.
- Background assets are selected and applied by tap/click only; they never
  require drag-to-canvas. Only actor/token assets use drag-to-canvas. Tapping a
  library actor is also supported when the Actor Tool already has a selected
  target Zone, creating the actor in that Zone with the active actor settings.
- Zoneless Actors is drawer-only in compact mode. At desktop it remains an
  overlaid canvas panel and retains its existing resize, collapse, contrast,
  and drag/drop behavior.
- Panel content and header actions are reused from existing panel components;
  responsive panel state is UI-only and is never persisted in EncounterState.

## Implementation boundaries

1. Update `src/ui/toolbar/` with centralized primary icons, compact/desktop
   rendering, touch tooltip support, 44px targets, and active-tool subtool
   extraction. Keep interaction state and action dispatch unchanged.
2. Update `src/ui/App.tsx` and add focused `src/ui/panels/` launcher/drawer
   components. Compose desktop docks and compact drawer presentation from the
   existing panel render callbacks, using the canonical six-target order.
3. Update canvas touch handlers and viewport gesture handling for one-finger
   editing, two-finger pan/pinch, and selection toggles without touch-hold
   right-click emulation anywhere in the application.
   Preserve desktop mouse/right-drag behavior and coordinate transforms.
4. Update the compact Zoneless panel and Asset Library modal layout so drawer
   content fits narrow dynamic viewports, remains internally scrollable, and
   preserves drag/drop continuation.
5. Keep all responsive state session-local. No domain schema, normalized
   entity, history, validator, or render-coordinate changes are permitted.

## Accessibility and interaction contract

- Every icon-only control has an explicit accessible name and title tooltip.
- Long press has keyboard equivalents; focus remains inside the active drawer
  until it closes, and focus returns to the launcher afterward.
- Drawer and menu expose stable labels based on the six canonical targets.
- Hidden desktop docks are removed from the active accessibility tree at
  compact widths.
- Touch tooltip timers are cleaned up on unmount and pointer cancellation.
- Responsive controls do not create Redux history entries.

## Verification

- Toolbar tests cover icon presence, desktop labels, compact semantics, 44px
  targets, secondary subtool placement, horizontal scrolling, zoom utility
  behavior, and touch tooltip timing.
- Panel tests cover Library default, short tap opening, persistent 500ms hold
  menu, tapped target selection without drawer opening, next-tap opening,
  canonical order, keyboard equivalents, focus return, and dismissal.
- Touch/canvas tests cover one-finger editing, two-finger pan/pinch, selection
  toggles, no touch-hold context emulation, and unchanged desktop gestures.
- Drawer drag tests cover automatic close and continued Library/Zoneless drags.
- Library tests cover tap-to-apply background assets, actor-only
  drag-to-canvas behavior, and tapping an actor after a target Zone has been
  selected.
- Narrow modal/panel tests cover viewport containment and internal scrolling.
- Run focused Vitest suites with `--reporter=agent`, `npm run typecheck`, and
  the complete `npm run test:agent` suite. Existing desktop tests must remain
  behavior-compatible.

## Fixed decisions

- Compact cutoff: Tailwind `lg` (1024px).
- Launcher hold threshold: 500ms.
- Initial and fallback launcher target: Library.
- Canonical target order: Library, Properties, Log, Status, Initiative,
  Zoneless.
- Long-press drag/release selects a target and closes the menu; it never opens
  that target drawer until a subsequent short tap.
- One drawer is visible at a time.
- Zoneless is drawer-only compact and remains an overlaid panel on desktop.
- Responsive presentation state is not persisted and is not undoable.

</proposed_plan>
