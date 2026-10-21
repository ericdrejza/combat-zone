import { SquareActivity, X } from 'lucide-react';
import { createContext, useContext, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { usePanelPopout } from '@hooks/usePanelPopout';
import { StatusPanel } from '@ui/panels/StatusPanel';
import { TouchTooltip } from '@ui/toolbar/TouchTooltip';
import { StatusDashboardContext } from './StatusDashboardContext';

const StatusPopoutContext = createContext({ statusOpen: false, openStatus: () => {} });

/** Both Status views share encounter selection, validation, writer guards, and history. */
export function StatusPopoutProvider({ children }: PropsWithChildren) {
  const { popup, root, open: openStatus, close } = usePanelPopout('status', 'Status', 760);
  return <StatusPopoutContext.Provider value={{ statusOpen: Boolean(popup), openStatus }}>
    {children}
    {root ? createPortal(<main className="h-dvh w-screen overflow-auto bg-canvas-panel text-canvas-ink">
      <div className="min-h-full min-w-[20rem] max-w-3xl p-4">
        <header className="mb-4 flex items-center gap-2">
          <SquareActivity aria-hidden="true" className="h-5 w-5" /><h1 className="mr-auto font-display text-xl font-semibold">Status</h1>
          <TouchTooltip label="Close Status window"><button aria-label="Close Status window" title="Close Status window" type="button" onClick={close}
            className="rounded-full border border-canvas-line p-2 hover:bg-canvas hover:text-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"><X aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>
        </header>
        <StatusDashboardContext.Provider value={true}><StatusPanel /></StatusDashboardContext.Provider>
      </div>
    </main>, root) : null}
  </StatusPopoutContext.Provider>;
}

export function useStatusPopout() { return useContext(StatusPopoutContext); }
