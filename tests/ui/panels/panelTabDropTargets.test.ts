import { resolvePanelPointerDropTarget } from "@ui/panels/panelPointerDrag";

function bounds(left: number, top: number): DOMRect {
  return { left, right: left + 40, top, bottom: top + 40, width: 40, height: 40 } as DOMRect;
}

it.each(["horizontal", "vertical"])("resolves beginning, gaps, and end positions of a %s tab container", axis => {
  const list = document.createElement("div");
  list.dataset.panelDropKind = "tabs";
  list.dataset.panelDropSide = "left";
  list.dataset.panelDropIndex = "3";
  for (let index = 0; index < 3; index += 1) {
    const tab = document.createElement("button");
    Object.assign(tab.dataset, { panelDropKind: "tab", panelDropSide: "left", panelDropIndex: String(index), panelDropAxis: axis });
    tab.getBoundingClientRect = () => axis === "horizontal" ? bounds(100 + index * 48, 100) : bounds(100, 100 + index * 48);
    list.append(tab);
  }
  const resolve = (position: number) => resolvePanelPointerDropTarget(
    axis === "horizontal" ? position : 120, axis === "horizontal" ? 120 : position, list
  );
  expect(resolve(96)).toEqual({ side: "left", index: 0 });
  expect(resolve(144)).toEqual({ side: "left", index: 1 });
  expect(resolve(240)).toEqual({ side: "left", index: 3 });
});

it("uses the hovered row when an expanded tab list wraps", () => {
  const list = document.createElement("div");
  Object.assign(list.dataset, { panelDropKind: "tabs", panelDropSide: "right", panelDropIndex: "4" });
  for (let index = 0; index < 4; index += 1) {
    const tab = document.createElement("button");
    Object.assign(tab.dataset, { panelDropKind: "tab", panelDropSide: "right", panelDropIndex: String(index), panelDropAxis: "horizontal" });
    tab.getBoundingClientRect = () => bounds(100 + (index % 2) * 48, 100 + Math.floor(index / 2) * 48);
    list.append(tab);
  }
  expect(resolvePanelPointerDropTarget(96, 168, list)).toEqual({ side: "right", index: 2 });
  expect(resolvePanelPointerDropTarget(192, 168, list)).toEqual({ side: "right", index: 4 });
});
