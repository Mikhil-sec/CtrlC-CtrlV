import { describe, expect, it } from "vitest";
import { distribute, formatMoney, parseAmount, toMinor } from "./money";

describe("toMinor", () => {
  it("converts rupees to whole cents", () => {
    expect(toMinor(1)).toBe(100);
    expect(toMinor(12_500.5)).toBe(1_250_050);
  });

  it("rounds rather than truncating", () => {
    expect(toMinor(0.005)).toBe(1);
    expect(toMinor(0.004)).toBe(0);
  });
});

describe("parseAmount", () => {
  it("accepts the ways people actually type amounts", () => {
    expect(parseAmount("12500")).toBe(1_250_000);
    expect(parseAmount("12,500")).toBe(1_250_000);
    expect(parseAmount("Rs 12 500.50")).toBe(1_250_050);
  });

  it("returns null for input that is not a number", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });
});

describe("distribute", () => {
  it("splits without losing or inventing a cent", () => {
    // 100 cents across three equal parts cannot divide evenly.
    const parts = distribute(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it("stays exact across a range of awkward splits", () => {
    const cases: Array<[number, number[]]> = [
      [1, [1, 1, 1, 1]],
      [7, [3, 5, 11]],
      [999_999, [17, 3, 101, 2]],
      [1_250_000, [9_000, 6_500, 3_500]],
    ];

    for (const [amount, weights] of cases) {
      const parts = distribute(amount, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(amount);
      expect(parts.every(Number.isInteger)).toBe(true);
    }
  });

  it("gives nothing away when there is nothing to give", () => {
    expect(distribute(0, [1, 2])).toEqual([0, 0]);
    expect(distribute(500, [0, 0])).toEqual([0, 0]);
  });
});

describe("formatMoney", () => {
  it("renders cents as Mauritian rupees", () => {
    expect(formatMoney(1_250_000)).toContain("12,500");
    expect(formatMoney(1_250_000)).toContain("Rs");
  });
});
