import { MVP_TOOLS } from "../../interaction/tools/toolRegistry";

export function Toolbar() {
  return (
    <header
      aria-label="Combat Zone toolbar"
      className="border-b border-canvas-line bg-canvas-panel px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 font-display text-2xl font-semibold tracking-tight">
          Combat Zone
        </h1>
        <nav aria-label="Tools" className="flex flex-wrap gap-2">
          {MVP_TOOLS.map((tool) => (
            <button
              key={tool.id}
              className="rounded-full border border-canvas-line bg-white px-3 py-1.5 text-sm font-medium text-canvas-ink shadow-sm transition hover:bg-canvas"
              title={tool.tooltip}
              type="button"
            >
              {tool.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
