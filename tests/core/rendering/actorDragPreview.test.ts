import { describe, expect, it, vi } from "vitest";

import { setActorDragImage } from "@core/rendering/actorDragPreview";

describe("actor drag preview", () => {
  it("uses an actor token and label instead of the source image alone", () => {
    const setDragImage = vi.fn();
    const cleanup = setActorDragImage(
      { setDragImage } as unknown as DataTransfer,
      {
        image: { kind: "embedded", dataUrl: "data:image/png;base64,token" },
        layoutGroup: "enemy",
        name: "Goblin",
        shape: "circle",
        size: "medium"
      }
    );
    const preview = setDragImage.mock.calls[0]?.[0] as HTMLElement;

    expect(preview).toBeInTheDocument();
    expect(preview.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,token"
    );
    expect(preview).toHaveTextContent("Goblin");
    expect(preview.firstElementChild).toHaveStyle({
      backgroundColor: "rgb(220, 38, 38)",
      borderRadius: "50%"
    });

    cleanup();
    expect(preview).not.toBeInTheDocument();
  });
});
