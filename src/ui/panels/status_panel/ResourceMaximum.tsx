/** The displayed maximum remains a separate, confirmed reset action. */
export function ResourceMaximum({ name, maximum, disabled, onReset, resetToZero = false }: { name: string; maximum: number; disabled: boolean; onReset: () => void; resetToZero?: boolean }) {
  return <span className="whitespace-nowrap">{maximum >= 10 && maximum <= 99 ? "/" : "/ "}<button aria-label={`Reset ${name} to ${resetToZero ? "zero" : "maximum"}`} title={`Reset current to ${resetToZero ? "zero" : "maximum"}`}
    className="rounded underline decoration-dotted enabled:hover:bg-canvas-surface enabled:hover:decoration-solid focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas-surface disabled:text-canvas-muted disabled:opacity-40"
    disabled={disabled} onClick={onReset} type="button">{maximum}</button></span>;
}
