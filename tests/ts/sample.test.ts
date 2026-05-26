import { describe, expect, it } from "../../dist/index.js";

interface Point {
  x: number;
  y: number;
}

const add = (a: number, b: number): number => a + b;

describe("typescript sample (strippable)", () => {
  it("runs a type-stripped .ts test", () => {
    const p: Point = { x: 1, y: 2 };
    expect(add(p.x, p.y)).toBe(3);
  });
});
