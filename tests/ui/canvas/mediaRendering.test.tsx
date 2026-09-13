import { render } from "@testing-library/react";

import { CanvasBackgroundLayer } from "@ui/canvas/background/CanvasBackgroundLayer";
import { ActorVisual } from "@ui/canvas/actors/ActorVisual";

const videoSource = { kind: "embedded" as const, dataUrl: "data:video/webm;base64,AA==" };

describe("canvas video media", () => {
  it("renders a background video as muted looping SVG content", () => {
    const { container } = render(
      <svg>
        <CanvasBackgroundLayer
          backgroundImage={{
            height: 1080,
            mediaType: "video/webm",
            name: "Storm",
            source: videoSource,
            width: 1920
          }}
          canvasSize={{ height: 1080, width: 1920 }}
        />
      </svg>
    );

    const video = container.querySelector("video");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveProperty("muted", true);
    expect(video).toHaveAttribute("playsinline");
  });

  it("renders a video token inside the actor visual", () => {
    const { container } = render(
      <svg>
        <ActorVisual
          actor={{
            actorType: "creature",
            currentZoneId: "zoneless",
            id: "actor-video",
            image: videoSource,
            layoutGroup: "neutral",
            metadata: { sourceAssetMediaType: "video/webm" },
            name: "Flame",
            shape: "circle",
            size: "medium",
            statusEffects: []
          }}
          clipId="actor-video-clip"
          fillColor="#000000"
          outlineColor="#ffffff"
          radius={24}
          selected={false}
          selectedTextColor="#ffffff"
          showFactionOutline={false}
          transition={{}}
        />
      </svg>
    );

    expect(container.querySelector("foreignObject video")).toHaveAttribute("loop");
  });
});
