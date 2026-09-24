import { describe, expect, it } from "vitest";
import { currentMonth } from "@/lib/engine/calendar";
import { demoGoals } from "@/lib/contract/fixtures";
import { findTargetDate, parseIntentFromText, parseScenarioFromText } from "./fallback";

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

describe("parseIntentFromText", () => {
  const goals = demoGoals("2026-09");

  it("declines a question that has nothing to do with money", () => {
    const intent = parseIntentFromText("who is donald trump", goals, "2026-09");
    expect(intent.intent).toBe("off_topic");
    expect(intent.reply).toMatch(/budget and savings goals/);
  });

  it("reads a goal with a date as a target to work back from", () => {
    const intent = parseIntentFromText(
      "I want to go to Japan at the end of 2026",
      goals,
      "2026-09",
    );
    expect(intent.intent).toBe("goal_seek");
    expect(intent.goal).toEqual({ goalId: "goal-trip", targetDate: "2026-12-31" });
  });

  it("reads 'N months sooner' against a named goal", () => {
    const intent = parseIntentFromText(
      "how much more do I need to earn to buy the laptop 2 months earlier?",
      goals,
      "2026-09",
    );
    expect(intent.goal).toEqual({ goalId: "goal-laptop", monthsEarlier: 2 });
  });

  it("still reads an ordinary change as a scenario", () => {
    const intent = parseIntentFromText("cut eating out by 30%", goals, "2026-09");
    expect(intent.intent).toBe("scenario");
    expect(intent.adjustments).toEqual([
      { type: "adjust_expense", category: "dining", byPercent: -30 },
    ]);
  });

  it("reads saving up for something new as a purchase, in rupees", () => {
    const intent = parseIntentFromText(
      "How can I budget 500 000 for a trip in dubai",
      goals,
      "2026-09",
    );
    expect(intent.intent).toBe("plan_purchase");
    expect(intent.purchase).toEqual({
      label: "Trip in dubai",
      amountMinor: 50_000_000,
    });
  });

  it("understands 80k and a named date on a purchase", () => {
    const intent = parseIntentFromText(
      "can I afford a car for 80k by december",
      goals,
      "2026-09",
    );
    expect(intent.intent).toBe("plan_purchase");
    expect(intent.purchase?.amountMinor).toBe(8_000_000);
    expect(intent.purchase?.targetDate).toBe("2026-12-31");
  });

  it("does not mistake a spending cut for a purchase", () => {
    const intent = parseIntentFromText("cut my car costs by 2000", goals, "2026-09");
    expect(intent.intent).toBe("scenario");
  });

  it("points a money question it cannot read at what it can", () => {
    const intent = parseIntentFromText("should I save more?", goals, "2026-09");
    expect(intent.intent).toBe("answer");
  });
});

describe("findTargetDate", () => {
  it("resolves a bare month to its next occurrence", () => {
    expect(findTargetDate("by march", "2026-09")).toBe("2027-03-31");
    expect(findTargetDate("by december", "2026-09")).toBe("2026-12-31");
  });

  it("honours an explicit year and 'next year'", () => {
    expect(findTargetDate("in june 2028", "2026-09")).toBe("2028-06-30");
    expect(findTargetDate("sometime next year", "2026-09")).toBe("2027-12-31");
  });

  it("returns null when no date is named", () => {
    expect(findTargetDate("soon please", "2026-09")).toBeNull();
  });
});
