import { describe, it, expect } from "vitest";
import { evaluateDice } from "@core/dice/evaluate";
import { messageFormulas } from "@core/dice/messageFormulas";
const roll = (formula: string) => evaluateDice(formula, () => 0.9);
describe("dice notation", () => {
  it.each([
    ["2d6+3",15], ["4d6kh3",18], ["2d20kl1",19], ["4d6dl1",18],
    ["floor(3d6/2)",9], ["ceil(1d6/4)",2], ["round(1d6/4)",2], ["abs(1-6)",5],
    ["4dF",4], ["d%",91], ["{2d6,3d6}kh1",18], ["4d6>4",4],
    ["4d6f1",0], ["4d6mt",1], ["2d6sa",12], ["2**3",8], ["7%3",1],
    ["(1d4)d6",24], ["1d20cs>18cf1",19], ["2d6[fire]+3",15]
  ])("evaluates %s", (formula, total) => expect(roll(formula).node.value).toBe(total));
  it.each([["d6!~2",18], ["d6!!~2",18], ["d6!p~2",16], ["d6r6~2",6], ["d6!~0",6]])("caps %s without discarding its result", (formula, total) => {
    const result = roll(formula as string); expect(result.node.value).toBe(total); expect(result.capped).toBe(true);
  });
  it("keeps nested repeat caps attached to their own modifiers", () => {
    const result = roll("d6r(1d4!~1)~2");
    expect(Number.isFinite(result.node.value)).toBe(true);
    expect(result.auxiliary?.[0].value).toBe(8);
    expect(result.capped).toBe(true);
  });
  it("does not duplicate shallow-cloned group pools as rule calculations", () => {
    expect(roll("{2d6,3d6}kh1").auxiliary).toBeUndefined();
  });
  it("uses uniform range-safe faces at both random-source boundaries", () => {
    expect(evaluateDice("d4", () => 0).node.value).toBe(1);
    expect(evaluateDice("d4", () => .999999).node.value).toBe(4);
  });
  it("retains discarded rerolls and compound individual faces", () => {
    expect(roll("d6r6~2").node.children?.filter(n => n.valid)).toHaveLength(1);
    expect(roll("d6!!~2").node.children?.[0].children).toHaveLength(3);
  });
  it.each(["d6 garbage", "d6! + 3~2", "d6!~x", "d6!~1001", "", "1/0", "10001d6"])("rejects invalid or oversized %s", formula => expect(() => roll(formula)).toThrow());
  it("extracts commands and multiple inline rolls with labels", () => {
    expect(messageFormulas("/roll 2d6")).toEqual(["2d6"]);
    expect(messageFormulas("/r d20")).toEqual(["d20"]);
    expect(messageFormulas("Fire [[2d6[fire]]] and [[d4]]")).toEqual(["2d6[fire]", "d4"]);
    expect(messageFormulas("I own 2d6 dice")).toEqual([]);
    expect(() => messageFormulas("[[d6]] and [[bad]]")).toThrow();
  });
});
