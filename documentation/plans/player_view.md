# Player View and Projected Viewport — #43

## Summary

Add a live player projection with a GM preview that replaces the workspace.
Preview and popout share identical content and framing. Follow the GM's visible
canvas region by default; allow independent player pan and zoom when unfollowed.
Projection controls remain outside encounter history.

## Rendering and camera

- Share live scene data across GM canvas, preview, and popout: entity movement,
  geometry/appearance/name previews, resource bars, conditions, locked rulers,
  and active measurements.
- Exclude selection indicators, editing handles, tool cursors, workspace panels,
  editing controls, and dialogs from player output.
- Hide the Skill Check edge badge, including its badge accessibility text, in
  preview and popout. Preserve the edge, other badges, and movement rules. Do not
  add trap properties or behavior.
- Keep the GM scene controller mounted during preview, preserving its viewport
  dimensions, live state, camera, selection, and active tool.
- Publish one committed GM camera snapshot after zoom and compensating scroll
  finish in layout effects. Preview/popout subscribe to that snapshot before
  paint instead of sampling new zoom with old scroll. Reuse GM zoom commands
  while following and compose independent relative zoom commands before render.
- Share a player camera region. Follow fits the exact GM-visible region within
  the configured aspect ratio using letterboxing. Navigation in following preview
  adjusts the underlying GM camera.
- Unfollow copies the current region into an independent camera; follow resumes
  GM framing immediately. Independent navigation leaves the GM camera unchanged.
- Reuse pan, zoom, fit, reset, wheel, and touch behavior. Preview and popout use
  the same scene and camera transform. Window resizing scales/letterboxes the
  configured frame without changing the visible region.
- Player output cannot edit entities. Use Motion and reduced-motion behavior;
  namespace SVG resources across scene instances.

## Controls, preferences, and lifecycle

- Start the extended zoom dropdown with Follow GM View, Player Preview, and
  Player Window in desktop, compact, and preview navigation. Keep it open for all
  three actions and transfer it to the active header across preview changes.
  Follow GM View uses a fixed unbroken link icon with active-state feedback.
  Preserve established hover/focus feedback and desktop/touch tooltips.
- Add customizable V (preview) and Ctrl+Shift+V (popout) shortcuts with typing,
  modal, repeat, and conflict guards. Move the inherited Select default from V to
  S, preserving actual custom bindings through the keybind preference migration.
- Preview replaces the workspace with a responsive GM-only strip: exit,
  navigation controls, aspect-ratio selection, and the extended zoom dropdown. Suppress editing
  shortcuts while previewing and restore the workspace on exit. Keep zoom
  navigation right-aligned in the preview header, with responsive wrapping.
  Right-click drag panning follows the existing Canvas Settings preference.
- Reuse browser-popout lifetime/styles/theme handling. Popout is canvas-only,
  with no additional writer or audio instance. Handle blocking, manual closure,
  reopening, and application shutdown.
- Add an upper-right player-window fullscreen toggle using its own document.
  Track browser exits, disable unsupported fullscreen, and handle rejected
  requests without changing the camera or encounter history.
  Mirror the toggle immediately after the GM preview's aspect-ratio selector,
  disabled until the player window opens. Both track the same fullscreen state;
  browser rejection directs the GM to the player-window button.
  Use automatic permission or existing player-window activation for immediate
  GM entry. Otherwise focus the player window and arm Enter/Spacebar, with instructions
  shared by GM/player controls; never require clicking the player button. Cancel
  on Escape, blur/backgrounding, closure or fullscreen changes. Ignore repeated,
  composed, modified or editing-context confirmation events. Keep immediate exit and
  direct player-window clicks available. Never simulate the confirmation input.
- Aspect-ratio choices: 16:9 (default), 16:10, 4:3, 21:9, and Custom. Custom
  proportions require positive integers; invalid drafts preserve the valid frame.
  Scale SVG output automatically to each display. Derive a stable logical frame
  from the ratio for navigation; migrate old resolution preferences to ratios.
- Canvas Settings persists the default aspect ratio, validates it, and includes
  it in Canvas reset. Preview changes are session overrides.
- Reload uses the saved default. Popout reopening and encounter switching retain
  session aspect ratio; each loaded encounter resets follow to on.
- Camera, follow, preview, and popout state are session-only. No encounter schema
  changes. Document behavior in DESIGN and add acceptance/roadmap checks, marking
  complete only after verification.

## Verification

- Cover framing/aspect ratios, letterboxing, follow transitions, navigation,
  resize, and encounter switching.
- Cover live-scene parity, hidden Skill Check badges/editor affordances, preview
  restoration, guarded/custom shortcuts, compact controls, and popup lifecycle.
- Cover presets, custom validation, default preference fallback/reset, and
  session overrides.
- Assert projection operations preserve encounter present/past/future/action
  logs in read-only tabs and every validation mode. Encounter undo/redo updates
  both views.
- Run npm run test:agent, type checking, and build; browser-check cross-window
  live motion, framing, and mouse/touch navigation without styling assertions.

## Implementation verification

- `npm run test:agent -- --maxWorkers=2 --testTimeout=15000`: 415 files,
  2,570 tests passed. Targeted projection, settings, and shortcut checks also pass.
- `npm run typecheck` and `npm run build` passed.
- Chrome desktop/compact checks passed for exact follow framing, independent
  navigation, two-finger pinch, history preservation, workspace restoration,
  hidden Skill Check badges, and live actor dragging across the player window.

- Dropdown placement follow-up: 31 affected viewport/player-view tests and
  `npm run typecheck` passed, including compact access and menu handoff.

- Zoom stability and retained-dropdown follow-up: 106 canvas/player test files
  (537 tests), then 60 targeted camera/menu tests passed. Type checking and the
  production build passed. Chrome recorded zero mixed zoom/scroll frames across
  100-frame followed zoom sequences (previously 17), identical preview/popout
  regions, unchanged entity coordinates/history, and no runtime errors. All
  three player toggles retain the single active dropdown through header changes.

- Fullscreen follow-up: all 38 player-view tests and type checking passed.
  Chrome verified entry/exit through real player-window mouse clicks and
  unchanged camera framing. Documented why the shared 16:9 presets look alike.

- Aspect-ratio and GM fullscreen follow-up: migrated saved pixel dimensions to
  equivalent ratios; added 16:9, 16:10, 4:3, 21:9, and Custom. Type checking,
  the production build, and 59 affected player/settings/viewport tests passed.
  Clean Chrome testing confirmed
  browser rejection feedback for fullscreen entry from the GM window, entry
  from the player window, exit from the GM header, and unchanged camera framing.

- Fullscreen keyboard handoff: automatic permission or a valid recent player
  gesture permits immediate GM entry. Otherwise the GM control focuses the
  player window and accepts a real Enter or Spacebar without any player-button
  click. Both controls share pending/state updates; Escape, blur and closure
  cancel. All 80 affected tests and type checking passed. Chrome verified native
  Enter/Spacebar entry, automatic focus, GM exit, Escape cancellation, and no
  duplicate toggle when the player's fullscreen button already has focus.
