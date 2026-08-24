import { useEffect, useState } from "react";

const WORKSPACE_LOCK_NAME = "combat-zone:workspace-writer";

type LockManagerWithIfAvailable = LockManager & {
  request(
    name: string,
    options: LockOptions & { ifAvailable: true },
    callback: (lock: Lock | null) => Promise<void>
  ): Promise<void>;
};

/** Holds the same-origin workspace writer lock until this hook unmounts. */
export function useWorkspaceWriterLock(enabled = true): boolean {
  const [readOnly, setReadOnly] = useState(
    () => enabled && typeof navigator !== "undefined" && Boolean(navigator.locks)
  );

  useEffect(() => {
    if (!enabled) {
      setReadOnly(false);
      return;
    }

    const locks = navigator.locks as LockManagerWithIfAvailable | undefined;
    if (!locks) {
      setReadOnly(false);
      return;
    }

    let mounted = true;
    let release: (() => void) | undefined;
    const controller = new AbortController();
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    void locks.request(
      WORKSPACE_LOCK_NAME,
      { ifAvailable: true, mode: "exclusive" },
      async (lock) => {
        if (!mounted) return;
        if (!lock) {
          setReadOnly(true);
          try {
            await locks.request(
              WORKSPACE_LOCK_NAME,
              { mode: "exclusive", signal: controller.signal },
              async () => {
                if (!mounted) return;
                setReadOnly(false);
                await hold;
              }
            );
          } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) {
              throw error;
            }
          }
          return;
        }
        setReadOnly(false);
        await hold;
      }
    ).catch((error) => {
      if (
        mounted &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setReadOnly(true);
      }
    });

    return () => {
      mounted = false;
      controller.abort();
      release?.();
    };
  }, [enabled]);

  return readOnly;
}
