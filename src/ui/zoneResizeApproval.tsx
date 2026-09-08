import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode
} from "react";

type ZoneResizeApprovalRequest = {
  onApprove: () => void;
};

type ZoneResizeApprovalContextValue = {
  requestApproval: (request: ZoneResizeApprovalRequest) => void;
};

const ZoneResizeApprovalContext =
  createContext<ZoneResizeApprovalContextValue | null>(null);

export function ZoneResizeApprovalProvider({
  children
}: { children: ReactNode }) {
  const [request, setRequest] = useState<ZoneResizeApprovalRequest | null>(null);
  const requestApproval = useCallback(
    (nextRequest: ZoneResizeApprovalRequest) => setRequest(nextRequest),
    []
  );

  function cancel() {
    setRequest(null);
  }

  function approve() {
    const onApprove = request?.onApprove;

    setRequest(null);
    onApprove?.();
  }

  return (
    <ZoneResizeApprovalContext.Provider value={{ requestApproval }}>
      {children}
      {request ? (
        <div
          aria-label="Resize zone approval"
          aria-modal="true"
          className="viewport-overlay z-[70] flex items-center justify-center overflow-y-auto bg-black/30 p-4"
          role="dialog"
        >
          <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-2xl">
            <p className="text-sm font-medium text-canvas-ink">
              Resize zone to approve this action?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl border border-canvas-line bg-canvas-surface px-4 py-2 text-sm font-medium transition hover:bg-canvas"
                onClick={cancel}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-medium text-canvas-on-ink transition hover:opacity-90"
                onClick={approve}
                type="button"
              >
                Resize
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ZoneResizeApprovalContext.Provider>
  );
}

export function useZoneResizeApproval() {
  const context = useContext(ZoneResizeApprovalContext);

  if (!context) {
    throw new Error(
      "useZoneResizeApproval must be used within ZoneResizeApprovalProvider"
    );
  }

  return context;
}
