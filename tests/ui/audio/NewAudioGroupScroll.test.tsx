import { render, screen } from "@testing-library/react";
import { animate } from "motion/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useNewAudioGroupScroll } from "@ui/audio/useNewAudioGroupScroll";

vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  animate: vi.fn((_from: number, to: number, options: { onUpdate: (value: number) => void; onComplete: () => void }) => {
    options.onUpdate(to); options.onComplete(); return { stop: vi.fn() };
  })
}));

function Harness({ ids, top, height }: { ids: string[]; top: number; height: number }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useNewAudioGroupScroll(ids, scrollRef);
  return <div data-testid="scroll" ref={(element) => {
    scrollRef.current = element;
    if (!element) return;
    Object.defineProperties(element, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 400 } });
    element.getBoundingClientRect = () => ({ top: 0, bottom: 400 } as DOMRect);
  }}>
    <header ref={(element) => { if (element) element.getBoundingClientRect = () => ({ height: 60 } as DOMRect); }} />
    {ids.map((id) => <div key={id} data-audio-group-id={id} ref={(element) => { if (element) element.getBoundingClientRect = () => ({ top, bottom: top + height, height } as DOMRect); }} />)}
  </div>;
}

describe("new Soundboard group scrolling", () => {
  it("reveals the bottom of a new group without scrolling existing groups on mount", () => {
    const { rerender } = render(<Harness ids={["existing"]} top={350} height={120} />);
    expect(screen.getByTestId("scroll").scrollTop).toBe(0);
    rerender(<Harness ids={["existing", "new"]} top={350} height={120} />);
    expect(screen.getByTestId("scroll").scrollTop).toBe(82);
    expect(animate).toHaveBeenCalled();
  });

  it("keeps a new group below the sticky header", () => {
    const { rerender } = render(<Harness ids={[]} top={40} height={120} />);
    screen.getByTestId("scroll").scrollTop = 100;
    rerender(<Harness ids={["new"]} top={40} height={120} />);
    expect(screen.getByTestId("scroll").scrollTop).toBe(68);
  });
});
