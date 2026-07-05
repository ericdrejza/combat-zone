export function CanvasShell() {
  return (
    <section
      aria-label="Encounter canvas"
      className="min-h-[32rem] overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm"
      role="main"
    >
      <svg
        aria-label="SVG encounter workspace"
        className="h-full min-h-[32rem] w-full"
        role="img"
        viewBox="0 0 960 640"
      >
        <rect fill="#fffaf0" height="640" width="960" />
        <path
          d="M0 560 C160 500 240 620 390 560 S650 480 960 560"
          fill="none"
          stroke="#d7cbb8"
          strokeWidth="3"
        />
      </svg>
    </section>
  );
}
