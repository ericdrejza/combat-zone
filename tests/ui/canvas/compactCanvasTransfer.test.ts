import {
  armCompactCanvasTransfer,
  COMPACT_CANVAS_TRANSFER_EVENT,
  type CompactCanvasTransferDetail
} from "@ui/canvas/compactCanvasTransfer";

describe("compact canvas transfer", () => {
  it.each(["mouse", "pen"] as const)(
    "can opt %s pointers into the same threshold transfer",
    (pointerType) => {
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
            pointerId: 6,
            pointerType
          }),
          {
            actor: {
              layoutGroup: "hero",
              name: "Actor 1",
              shape: "circle",
              size: "medium"
            },
            actorIds: ["actor-1"],
            kind: "zoneless-actors"
          },
          undefined,
          "all"
        );

        window.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX: 20,
            clientY: 10,
            pointerId: 6,
            pointerType
          })
        );

        expect(details[0]?.payload).toEqual({
          actor: {
            layoutGroup: "hero",
            name: "Actor 1",
            shape: "circle",
            size: "medium"
          },
          actorIds: ["actor-1"],
          kind: "zoneless-actors"
        });
      } finally {
        window.removeEventListener(COMPACT_CANVAS_TRANSFER_EVENT, listener);
      }
    }
  );

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

  it("carries configured new-actor data for a touch canvas transfer", () => {
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
          pointerId: 8,
          pointerType: "touch"
        }),
        {
          actor: {
            layoutGroup: "enemy",
            name: "Touch Actor",
            shape: "circle",
            size: "medium"
          },
          kind: "new-actor"
        }
      );

      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 20,
          clientY: 10,
          pointerId: 8,
          pointerType: "touch"
        })
      );

      expect(details[0]?.payload).toEqual({
        actor: {
          layoutGroup: "enemy",
          name: "Touch Actor",
          shape: "circle",
          size: "medium"
        },
        kind: "new-actor"
      });
    } finally {
      window.removeEventListener(COMPACT_CANVAS_TRANSFER_EVENT, listener);
    }
  });
});
