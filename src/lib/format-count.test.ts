import { describe, expect, it } from "vitest";
import { formatResultCount } from "./format-count";

describe("formatResultCount", () => {
  it("renders exact counts in full", () => {
    expect(formatResultCount(0)).toBe("0");
    expect(formatResultCount(42)).toBe("42");
    expect(formatResultCount(1234)).toBe("1,234");
    expect(formatResultCount(1_203_417)).toBe("1,203,417");
  });

  it("defaults to exact when estimation is not stated", () => {
    expect(formatResultCount(999)).toBe("999");
  });

  it("abbreviates estimates in the millions to one decimal", () => {
    expect(formatResultCount(1_203_417, true)).toBe("~1.2M");
    expect(formatResultCount(2_500_000, true)).toBe("~2.5M");
  });

  it("drops the decimal past ten million, where it is noise", () => {
    expect(formatResultCount(12_400_000, true)).toBe("~12M");
  });

  it("abbreviates estimates in the thousands", () => {
    expect(formatResultCount(45_800, true)).toBe("~46K");
    expect(formatResultCount(10_000, true)).toBe("~10K");
  });

  it("rounds smaller estimates to a readable step", () => {
    expect(formatResultCount(1_240, true)).toBe("~1,200");
    expect(formatResultCount(3_070, true)).toBe("~3,100");
  });

  it("never implies more precision than an estimate has", () => {
    // An estimate should not render as an exact-looking figure.
    expect(formatResultCount(1_203_417, true)).not.toContain("417");
  });
});
