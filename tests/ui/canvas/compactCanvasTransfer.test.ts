import {
  armCompactCanvasTransfer,
  COMPACT_CANVAS_TRANSFER_EVENT,
  type CompactCanvasTransferDetail
} from "@ui/canvas/compactCanvasTransfer";

describe("compact canvas transfer", () => {
  it("starts only after a touch pointer crosses the movement threshold", () => {
    const details: CompactCanvasTransferDetail[] = [];
    const listener = (event: Event) => {
      details.push((event as CustomEvent<CompactCanvasTransferDetail>).detail);
    };
    window.addEventListener(COMPACT_CANVAS_TRANSFER_EVENT, listener);

    try {
      armCompactCanvasTransfer(
        new PointerEvent("pointerdown", {
          button: 0,
          clientX: 10,
          clientY: 10,
          pointerId: 7,
          pointerType: "touch"
        }),
        { kind: "library-node", nodeId: "token-1" }
      );

      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 14,
          clientY: 14,
          pointerId: 7,
          pointerType: "touch"
        })
      );
      expect(details).toEqual([]);

      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 22,
          clientY: 10,
          pointerId: 7,
          pointerType: "touch"
        })
      );

      expect(details).toEqual([
        {
          clientX: 22,
          clientY: 10,
          payload: { kind: "library-node", nodeId: "token-1" },
          pointerId: 7
        }
      ]);
    } finally {
      window.removeEventListener(COMPACT_CANVAS_TRANSFER_EVENT, listener);
    }
  });
});
