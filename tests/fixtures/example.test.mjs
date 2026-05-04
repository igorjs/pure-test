import { describe, expect, it } from "../../dist/index.js";

describe("example", () => {
  it("adds numbers", () => {
    expect(1 + 1).toBe(2);
  });

  it("compares strings", () => {
    expect("hello").toContain("ell");
  });
});
