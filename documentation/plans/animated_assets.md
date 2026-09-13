# Animated Assets Plan

## Status

Implemented. This document records the animated background and token behavior
introduced for local Library assets.

## Asset support

- Library uploads accept images plus MP4 and WebM files for Backgrounds and
  Tokens. Embedded uploads record intrinsic dimensions so video backgrounds
  use the existing canvas-sizing workflow.
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
- Size labels apply only to direct embedded uploads. They are derived from the
  base64 data URL rather than persisted separately, avoiding redundant state.
- Grid cards show size below the name; list rows place it after the name and
  before a source-type icon.

## Outstanding performance work

Performance issues are still present and need investigation. In particular,
large embedded media assets can increase memory pressure through data URLs,
decoded image/video frames, library previews, canvas captures, and concurrent
media elements. Profile upload, Library navigation, preview, and canvas paths
with realistic asset sizes before choosing optimizations. Potential follow-up
areas include object-URL lifecycle management, preview virtualization,
thumbnail/first-frame caching, limiting simultaneous decoders, and moving
large local asset bytes behind the repository/storage boundary.

The first performance pass now pauses videos outside the viewport and while the
document is hidden, releases media resources on unmount and after luminance
sampling, and renders shared bounded first-frame posters instead of retaining
paused video decoders. Animated WebP inspection and poster capture are cached,
and actor metadata preserves the upload-time animation result. Moving embedded
video bytes behind the repository boundary and establishing a simultaneous
canvas playback budget remain outstanding.
