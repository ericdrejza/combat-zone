import { render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import { describe, expect, it } from "vitest";

import { AssetLibraryPreview } from "@ui/library/AssetLibraryPreview";
import type { AssetLibraryPreviewTarget } from "@ui/library/assetLibraryView";

const target: AssetLibraryPreviewTarget = {
  id: "first-token",
  name: "Scout",
  asset: {
    name: "Scout",
    mediaType: "image/png",
    source: { kind: "url", url: "https://example.com/scout.png" }
  }
};

describe("Library visual preview scrolling", () => {
  it("keeps scrolling for the current asset and resets for another entry sharing its image", () => {
    const rotation = motionValue("0deg");
    const preview = (selected: AssetLibraryPreviewTarget | null) => (
      <AssetLibraryPreview playAnimations={false} rotation={rotation} target={selected} />
    );
    const { rerender } = render(preview(target));
    const scrollArea = screen.getByRole("region", { name: "Scout preview scroll area" });
    scrollArea.scrollTop = 150;
    rerender(preview({ ...target }));
    expect(scrollArea.scrollTop).toBe(150);
    rerender(preview({ ...target, id: "second-token" }));
    expect(scrollArea.scrollTop).toBe(0);
    scrollArea.scrollTop = 80;
    rerender(preview(target));
    expect(scrollArea.scrollTop).toBe(0);
  });
});
