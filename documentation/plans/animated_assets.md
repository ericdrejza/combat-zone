# Animated Assets Plan

## Status

Implemented. This document records the animated background and token behavior
introduced for local Library assets.

## Asset support

- Library uploads accept images plus MP4 and WebM files for Backgrounds and
  Tokens. Uploads record intrinsic dimensions so video backgrounds use the
  existing canvas-sizing workflow.
- Animated WebP files are detected from their RIFF animation metadata and are
  marked with the Video icon. The same icon identifies MP4 and WebM assets.
- Library cards identify non-default asset sources. Standard uploaded still
  images do not show a source/type icon.

## Playback behavior

- Settings → Interface → General contains **Enable animation**, enabled by
  default and persisted with interface preferences.
- When disabled, video assets immediately pause and reset to frame zero across
  canvas backgrounds, actor tokens, library cards, previews, and the Library
  panel. Animated WebP token assets capture and display their first frame on
  the canvas.
- The Backgrounds and Tokens Library tabs include a Play button that controls
  animated card and preview playback. It starts off when the modal opens.
  The control is disabled, visibly muted, and explains that Interface settings
  disabled animation when the global preference is off.
- The implementation uses imperative `HTMLVideoElement.play()` / `pause()`
  synchronization because changing React's `autoPlay` prop does not stop an
  already-playing video.

## Library size display

- Background and Token tabs offer a size toggle beside the Play control. The
  Encounters tab does not display this control.
- Size labels apply to local uploads. Repository-backed sources retain their
  byte length in the source descriptor; legacy embedded sources derive it from
  the base64 data URL.
- Grid cards show size below the name; list rows place it after the name and
  before a source-type icon.

## Performance implementation

The first performance pass pauses videos outside the viewport and while the
document is hidden, releases media resources on unmount and after luminance
sampling, and renders shared bounded first-frame posters instead of retaining
paused video decoders. Animated WebP inspection and poster capture are cached,
and actor metadata preserves the upload-time animation result.

New uploads store bytes once in the repository's content-addressed `assets`
store and keep only a small `local_asset` descriptor in Library and encounter
state. Rendering shares resolved object URLs, legacy embedded assets migrate on
startup, and orphan cleanup is delayed until a later startup so undo/redo stays
safe for the current session. Workspace and encounter exports embed the bytes
again, preserving portable, lossless files. A simultaneous canvas playback
budget remains an optional follow-up if real-world profiling shows that many
visible animations can still exhaust decoder resources.
