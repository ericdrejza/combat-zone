import { createWebImageAsset } from "@library/webImageAsset";

describe("createWebImageAsset", () => {
  it("keeps the web URL as the asset source without copying image data", () => {
    expect(
      createWebImageAsset("https://images.example/maps/ruins.webp?version=2")
    ).toEqual({
      dataUrl: "https://images.example/maps/ruins.webp?version=2",
      mediaType: "image/webp",
      name: "ruins.webp"
    });
  });

  it("rejects non-web URL protocols", () => {
    expect(() => createWebImageAsset("file:///tmp/map.png")).toThrow(
      "Enter an http or https image URL."
    );
  });
});
