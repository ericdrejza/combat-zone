import { fireEvent, render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import { describe, expect, it } from "vitest";

import { AssetImagePreview } from "@ui/library/AssetImagePreview";

describe("AssetImagePreview", () => {
  it("shows a replacement image after its new source loads", () => {
    const rotation = motionValue("0deg");
    const { rerender } = render(
      <AssetImagePreview
        imageAlt="Goblin"
        name="Goblin"
        rotation={rotation}
        source={{ kind: "url", url: "https://example.com/original.png" }}
      />
    );

    fireEvent.load(screen.getByRole("img", { name: "Goblin" }));
    expect(
      screen.queryByRole("status", { name: "Goblin image loading" })
    ).not.toBeInTheDocument();

    rerender(
      <AssetImagePreview
        imageAlt="Goblin"
        name="Goblin"
        rotation={rotation}
        source={{ kind: "url", url: "https://example.com/replacement.webp" }}
      />
    );

    const replacement = screen.getByRole("img", { name: "Goblin" });
    expect(replacement).toHaveAttribute(
      "src",
      "https://example.com/replacement.webp"
    );
    fireEvent.load(replacement);
    expect(
      screen.queryByRole("status", { name: "Goblin image loading" })
    ).not.toBeInTheDocument();
    expect(replacement).toBeVisible();
  });

  it("shows a failed-image state instead of an endless loader", () => {
    render(
      <AssetImagePreview
        imageAlt="Goblin"
        name="Goblin"
        rotation={motionValue("0deg")}
        source={{ kind: "url", url: "https://example.com/missing.png" }}
      />
    );

    fireEvent.error(screen.getByRole("img"));

    expect(screen.getByLabelText("Goblin image failed to load"))
      .toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Goblin image loading" })
    ).not.toBeInTheDocument();
  });
});
