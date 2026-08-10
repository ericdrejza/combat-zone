import { act } from "@testing-library/react";

export function createActorDragDataTransfer() {
  const data = new Map<string, string>();
  const types: string[] = [];

  return {
    dropEffect: "none",
    effectAllowed: "none",
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
      types.push(type);
    },
    types
  };
}

export function dropOnCanvas(
  canvas: HTMLElement,
  transfer: ReturnType<typeof createActorDragDataTransfer>,
  clientX: number,
  clientY: number
) {
  const event = new Event("drop", { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: transfer }
  });
  act(() => {
    canvas.dispatchEvent(event);
  });
}
