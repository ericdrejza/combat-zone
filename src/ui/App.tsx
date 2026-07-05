import { CanvasShell } from "./canvas/CanvasShell";
import { PanelsShell } from "./panels/PanelsShell";
import { Toolbar } from "./toolbar/Toolbar";

export function App() {
  return (
    <div className="min-h-screen bg-canvas text-canvas-ink">
      <Toolbar />
      <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)_18rem]">
        <PanelsShell side="left" />
        <CanvasShell />
        <PanelsShell side="right" />
      </main>
    </div>
  );
}
