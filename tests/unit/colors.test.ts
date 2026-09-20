import { describe, expect, test } from "vitest";

import { contrastTextColor } from "@/lib/colors";

describe("contrastTextColor", () => {
  test("bright backgrounds use dark text", () => {
    expect(contrastTextColor("#f59e0b")).toBe("#191f28");
  });

  test("dark backgrounds use white text", () => {
    expect(contrastTextColor("#1f2937")).toBe("#ffffff");
  });

  test("invalid values fall back to dark text", () => {
    expect(contrastTextColor("green")).toBe("#191f28");
  });
});
