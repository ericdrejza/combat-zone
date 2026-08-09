import {
  getActiveBackgroundFitMode,
  getBackgroundFitCanvasSize,
  scaleCanvasSize
} from "@ui/toolbar/background/backgroundSizing";

const image = {
  dataUrl: "data:image/png;base64,map",
  height: 500,
  mediaType: "image/png",
  name: "map.png",
  width: 1000
};
const viewport = { height: 400, width: 600 };

describe("background sizing", () => {
  it("fits without exceeding either viewport dimension", () => {
    expect(getBackgroundFitCanvasSize(image, viewport, "fit")).toEqual({
      height: 300,
      width: 600
    });
  });

  it("fits one requested axis while preserving image aspect ratio", () => {
    expect(getBackgroundFitCanvasSize(image, viewport, "fit-width")).toEqual({
      height: 300,
      width: 600
    });
    expect(getBackgroundFitCanvasSize(image, viewport, "fit-height")).toEqual({
      height: 400,
      width: 800
    });
  });

  it("derives radio state and preserves aspect ratio when scaling", () => {
    expect(getActiveBackgroundFitMode({ height: 300, width: 600 }, image, viewport)).toBe("fit");
    expect(getActiveBackgroundFitMode({ height: 400, width: 800 }, image, viewport)).toBe("fit-height");
    expect(getActiveBackgroundFitMode({ height: 360, width: 720 }, image, viewport)).toBeNull();
    expect(scaleCanvasSize({ height: 400, width: 800 }, 0.9)).toEqual({
      height: 360,
      width: 720
    });
  });
});
