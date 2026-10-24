# Focus Light

- Add a customizable Canvas Focus action bound to F, preserving existing custom
  bindings that already use F. Default to holding; Canvas → Focus also offers
  press-to-toggle activation. Ignore repeats, typing, and modal workflows.
- Temporarily prevent canvas edits while active without changing tool/selection.
  Release held keys reliably after modifier/focus changes. Clear on Escape,
  window blur/backgrounding, encounter changes, or activation/binding changes.
  Do not interrupt an already active pointer gesture.
- Render a glowing red laser circle above scene/ruler content with a smooth
  flowing trail. Share one Motion clock and MotionValues across GM/preview/popout,
  using canvas coordinates and accounting for zoom and projection letterboxes.
  Hide outside the visible canvas and exclude player-window input.
- Add a Focus Canvas subsection with shared color picker, tail length and glow
  intensity sliders. Tail zero disables the trail; glow zero disables glow.
  Persist validated preferences through the existing Canvas preference boundary
  with defaults/red/reset/cross-tab behavior. Reduced motion removes the trail.
  Default tail length to 50%; the old 15% maps to the new 50%, with the maximum
  reduced to the old 30%. Preserve existing stored lengths and cap oversized ones.
- Keep all pointer/activation state outside Redux encounter history and logs.
  Verify every validation mode and read-only mode, key guards, edit suppression,
  preview/player parity, coordinate mapping, flow behavior, and settings/reset.

## Verification

- Broader canvas/player/settings/shortcut tests: 113 files, 692 tests passed.
- Final affected Focus/player tests (including fullscreen permission changes):
  9 files, 60 tests passed. Type checking and production build passed.
- Chrome checked 24 moving frames for identical GM/player pointer/trail geometry,
  held release, preview input, reduced motion, compact layout, unchanged history,
  and no runtime errors. The laser was visually inspected on the GM canvas.
