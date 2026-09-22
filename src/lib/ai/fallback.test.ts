import { describe, expect, it } from "vitest";
import { currentMonth } from "@/lib/engine/calendar";
import { parseScenarioFromText } from "./fallback";

describe("parseScenarioFromText", () => {
  it("reads a percentage cut to one category", () => {
    const scenario = parseScenarioFromText("cut dining out by 30%");
    expect(scenario?.adjustments).toEqual([
      { type: "adjust_expense", category: "dining", byPercent: -30 },
    ]);
  });

  it("reads a named-month start for a raise", () => {
    const now = new Date();
    // Pick a month a few months out so the "next occurrence" resolution is
    // unambiguous regardless of when this test runs.
    const targetCalendarMonth = ((now.getMonth() + 4) % 12) + 1;
    const monthName = new Date(2000, targetCalendarMonth - 1, 1).toLocaleString(
      "en-US",
      {
        month: "long",
      },
    );

    const scenario = parseScenarioFromText(
      `give me a Rs 3000 raise starting in ${monthName}`,
    );
    const adjustment = scenario?.adjustments[0];
    expect(adjustment?.type).toBe("adjust_income");
    if (adjustment?.type === "adjust_income") {
      expect(adjustment.byAmountMinor).toBe(300_000);
      expect(adjustment.fromMonth).toBeGreaterThan(0);
    }
  });

  it("applies with no fromMonth when no start is named", () => {
    const scenario = parseScenarioFromText("cut my grocery spending by 10%");
    const adjustment = scenario?.adjustments[0];
    expect(adjustment?.type).toBe("adjust_expense");
    if (adjustment?.type === "adjust_expense") {
      expect(adjustment.fromMonth).toBeUndefined();
    }
  });

  it("places a one-off amount in the named month", () => {
    const start = currentMonth();
    const [, month] = start.split("-").map(Number);
    // September for a January start, otherwise a month several out.
    const targetCalendarMonth = ((month + 5) % 12) + 1;
    const monthName = new Date(2000, targetCalendarMonth - 1, 1).toLocaleString(
      "en-US",
      {
        month: "long",
      },
    );

    const scenario = parseScenarioFromText(
      `I'm getting a bonus of Rs 20000 in ${monthName}`,
    );
    const adjustment = scenario?.adjustments[0];
    expect(adjustment?.type).toBe("one_off_inflow");
    if (adjustment?.type === "one_off_inflow") {
      expect(adjustment.amountMinor).toBe(2_000_000);
      expect(adjustment.monthIndex).toBeGreaterThan(0);
    }
  });

  it("places a one-off amount this month when no start is named", () => {
    const scenario = parseScenarioFromText("I got a bonus of Rs 20000");
    const adjustment = scenario?.adjustments[0];
    expect(adjustment?.type).toBe("one_off_inflow");
    if (adjustment?.type === "one_off_inflow") {
      expect(adjustment.monthIndex).toBe(0);
    }
  });

  it("reads a request to prioritise the nearest deadline", () => {
    const scenario = parseScenarioFromText("fund whichever goal is due soonest first");
    expect(scenario?.adjustments).toContainEqual({
      type: "set_allocation",
      strategy: "deadline",
    });
  });

  it("gives up cleanly on something nonsensical", () => {
    expect(parseScenarioFromText("what is the meaning of life")).toBeNull();
  });
});
