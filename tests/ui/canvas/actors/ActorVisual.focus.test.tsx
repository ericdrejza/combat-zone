import { render } from "@testing-library/react";
import { ActorVisual } from "@ui/canvas/actors/ActorVisual";
import { createActor } from "./actorLayerTestFixtures";

const focus = { x: 0.375, y: 0.25, width: 0.25, height: 0.5 };
const props = { clipId: "focus-clip", fillColor: "#ff0000", outlineColor: "#00ff00", radius: 60,
  selected: false, selectedTextColor: "#000000", showFactionOutline: true, transition: { duration: 0 } };

it.each(["circle", "rectangle"] as const)("renders the saved source rectangle through the fixed %s clip", shape => {
  const actor = { ...createActor("zoneless"), shape, imageFocus: focus };
  const { container } = render(<svg><ActorVisual {...props} actor={actor} /></svg>);
  const image = container.querySelector("image")!;
  expect(image.getAttribute("preserveAspectRatio")).toBe("none");
  expect(image.getAttribute("x")).toBe("-228");
  expect(image.getAttribute("y")).toBe("-114");
  expect(image.getAttribute("width")).toBe("456");
  expect(image.getAttribute("height")).toBe("228");
  expect(image.parentElement!.getAttribute("clip-path")).toBe("url(#focus-clip)");
  expect(container.querySelector(shape === "circle" ? "clipPath circle" : "clipPath rect")).not.toBeNull();
});

it("retains Transparent's whole-image presentation and restores the crop when switching back", () => {
  const actor = { ...createActor("zoneless"), imageFocus: focus };
  const { container, rerender } = render(<svg><ActorVisual {...props} actor={{ ...actor, shape: "transparent" }} /></svg>);
  expect(container.querySelector("image")!.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  expect(container.querySelector("image")!.getAttribute("width")).toBe("120");
  expect(container.querySelector("clipPath")).toBeNull();
  rerender(<svg><ActorVisual {...props} actor={actor} /></svg>);
  expect(container.querySelector("image")!.getAttribute("width")).toBe("456");
});
