type PanelsShellProps = {
  side: "left" | "right";
};

const panelLabels: Record<PanelsShellProps["side"], string[]> = {
  left: ["Library", "Initiative"],
  right: ["Properties", "Validation"]
};

export function PanelsShell({ side }: PanelsShellProps) {
  return (
    <aside aria-label={`${side} panels`} className="space-y-4">
      {panelLabels[side].map((label) => (
        <section
          key={label}
          className="rounded-3xl border border-canvas-line bg-canvas-panel p-4 shadow-sm"
        >
          <h2 className="font-display text-lg font-semibold">{label}</h2>
          <p className="mt-2 text-sm text-canvas-muted">
            Boilerplate panel shell. Feature-specific controls will be added
            as roadmap tickets are implemented.
          </p>
        </section>
      ))}
    </aside>
  );
}
