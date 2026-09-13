import { render } from "@testing-library/react";

import { InterfacePreferenceProvider } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LibraryPanelNode } from "@ui/panels/LibraryPanelNode";

const node = {
  id: "animated-token",
  name: "Animated token",
  parentId: "tokens-root",
  sectionId: "tokens" as const,
  type: "image" as const
};

describe("LibraryPanelNode animation", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("does not render an animated WebP source while global animation is disabled", () => {
    localStorage.setItem(
      "combat-zone.interface-preferences",
      JSON.stringify({ enableAssetAnimation: false })
    );
    const source = "https://example.com/animated.webp";
    const { container } = render(
      <InterfacePreferenceProvider>
        <LibraryPanelNode
          asset={{
            animated: true,
            mediaType: "image/webp",
            name: "animated.webp",
            source: { kind: "url", url: source }
          }}
          isBackground={false}
          isToken
          node={node}
          onClick={() => undefined}
          onDragEnd={() => undefined}
          onDragStart={() => undefined}
          onNavigate={() => undefined}
          viewMode="grid"
        />
      </InterfacePreferenceProvider>
    );

    expect(container.querySelector("video")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toHaveAttribute("src", source);
  });
});
