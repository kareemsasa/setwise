import { describe, it, expect } from "vitest";
import {
  dayNameToDbDay,
  generateScheduledDates,
} from "../src/schedule-dates.js";

describe("dayNameToDbDay", () => {
  it("maps monday to 0", () => {
    expect(dayNameToDbDay("monday")).toBe(0);
  });

  it("maps sunday to 6", () => {
    expect(dayNameToDbDay("sunday")).toBe(6);
  });

  it("is case-insensitive", () => {
    expect(dayNameToDbDay("Monday")).toBe(0);
    expect(dayNameToDbDay("FRIDAY")).toBe(4);
  });

  it("returns undefined for unknown day", () => {
    expect(dayNameToDbDay("notaday")).toBeUndefined();
  });
});

describe("generateScheduledDates", () => {
  // 2026-06-01 is a Monday
  const startDate = "2026-06-01";

  it("generates dates for a single day over 1 week", () => {
    const dates = generateScheduledDates(startDate, 1, [0]); // Monday
    expect(dates).toEqual([{ date: "2026-06-01", dayOfWeek: 0 }]);
  });

  it("generates dates for a single day over 4 weeks", () => {
    const dates = generateScheduledDates(startDate, 4, [0]); // Monday
    expect(dates).toEqual([
      { date: "2026-06-01", dayOfWeek: 0 },
      { date: "2026-06-08", dayOfWeek: 0 },
      { date: "2026-06-15", dayOfWeek: 0 },
      { date: "2026-06-22", dayOfWeek: 0 },
    ]);
  });

  it("includes startDate when it matches a template day", () => {
    const dates = generateScheduledDates(startDate, 1, [0]);
    expect(dates[0].date).toBe("2026-06-01");
  });

  it("uses next occurrence when template day has passed in start week", () => {
    // 2026-06-03 is Wednesday, template day is Monday (dbDay=0)
    const dates = generateScheduledDates("2026-06-03", 1, [0]);
    expect(dates).toEqual([{ date: "2026-06-08", dayOfWeek: 0 }]);
  });

  it("generates multiple days per week sorted by date", () => {
    const dates = generateScheduledDates(startDate, 2, [0, 3]);
    expect(dates).toEqual([
      { date: "2026-06-01", dayOfWeek: 0 },
      { date: "2026-06-04", dayOfWeek: 3 },
      { date: "2026-06-08", dayOfWeek: 0 },
      { date: "2026-06-11", dayOfWeek: 3 },
    ]);
  });

  it("generates 4 days/week over 4 weeks = 16 dates", () => {
    const dates = generateScheduledDates(startDate, 4, [0, 1, 3, 4]);
    expect(dates).toHaveLength(16);
    expect(dates[0].date).toBe("2026-06-01"); // Mon
    expect(dates[1].date).toBe("2026-06-02"); // Tue
    expect(dates[2].date).toBe("2026-06-04"); // Thu
    expect(dates[3].date).toBe("2026-06-05"); // Fri
  });

  it("returns empty array when no template days", () => {
    const dates = generateScheduledDates(startDate, 4, []);
    expect(dates).toEqual([]);
  });
});
