// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "../../dist/index.js";

describe("example", () => {
  it("adds numbers", () => {
    expect(1 + 1).toBe(2);
  });

  it("compares strings", () => {
    expect("hello").toContain("ell");
  });
});
