import { act, renderHook } from "@testing-library/react";

import {
  COMPACT_LAYOUT_QUERY,
  useCompactLayout
} from "@hooks/useCompactLayout";

describe("useCompactLayout", () => {
  it("tracks the shared compact workspace media query", () => {
    const listeners = new Set<() => void>();
    let matches = true;
    const originalMatchMedia = window.matchMedia;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener)
    }));

    try {
      const { result } = renderHook(() => useCompactLayout());
      expect(window.matchMedia).toHaveBeenCalledWith(COMPACT_LAYOUT_QUERY);
      expect(result.current).toBe(true);

      act(() => {
        matches = false;
        listeners.forEach((listener) => listener());
      });

      expect(result.current).toBe(false);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
