import { describe, expect, it } from "vitest";
import {
  addMonths,
  calendarMonth,
  monthOf,
  monthRange,
  monthsBetween,
} from "./calendar";

describe("addMonths", () => {
  it("moves within a year", () => {
    expect(addMonths("2026-01", 3)).toBe("2026-04");
  });

  it("rolls over a year boundary in both directions", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-02", -3)).toBe("2025-11");
  });

  it("returns the same month for a zero offset", () => {
    expect(addMonths("2026-07", 0)).toBe("2026-07");
  });

  it("rejects a malformed month key rather than guessing", () => {
    expect(() => addMonths("2026-13", 1)).toThrow();
  });
});

describe("monthsBetween", () => {
  it("counts forwards and backwards", () => {
    expect(monthsBetween("2026-01", "2026-04")).toBe(3);
    expect(monthsBetween("2026-04", "2026-01")).toBe(-3);
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
  });

  it("is the inverse of addMonths", () => {
    for (const offset of [0, 1, 7, 18, 60]) {
      expect(monthsBetween("2026-03", addMonths("2026-03", offset))).toBe(offset);
    }
  });
});

describe("monthOf", () => {
  it("takes the month from an ISO date", () => {
    expect(monthOf("2026-09-22")).toBe("2026-09");
  });
});

describe("calendarMonth", () => {
  it("reads the month number", () => {
    expect(calendarMonth("2026-12")).toBe(12);
    expect(calendarMonth("2026-01")).toBe(1);
  });
});

describe("monthRange", () => {
  it("produces a consecutive run", () => {
    expect(monthRange("2026-11", 4)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});
