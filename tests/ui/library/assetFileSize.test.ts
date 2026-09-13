import { describe, expect, it } from "vitest";

import { getUploadedAssetSizeLabel } from "@ui/library/assetFileSize";

const node = {
  id: "asset",
  name: "Map",
  parentId: "backgrounds-root",
  sectionId: "backgrounds" as const,
  type: "image" as const
};

describe("getUploadedAssetSizeLabel", () => {
  it("formats local upload sizes and excludes linked assets", () => {
    const asset = {
      mediaType: "image/png",
      name: "map.png",
      source: { dataUrl: "data:image/png;base64,QUJDRA==", kind: "embedded" as const }
    };

    expect(getUploadedAssetSizeLabel(node, asset)).toBe("1 KB");
    expect(getUploadedAssetSizeLabel({ ...node, type: "link" }, asset)).toBeNull();
  });
});
