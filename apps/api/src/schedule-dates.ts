const DAY_NAME_TO_DB: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export function dayNameToDbDay(name: string): number | undefined {
  return DAY_NAME_TO_DB[name.toLowerCase()];
}

export function generateScheduledDates(
  startDate: string,
  weeks: number,
  templateDays: number[],
): { date: string; dayOfWeek: number }[] {
  const start = new Date(startDate + "T00:00:00Z");
  const endMs = start.getTime() + weeks * 7 * 24 * 60 * 60 * 1000;
  const results: { date: string; dayOfWeek: number }[] = [];

  for (const dbDay of templateDays) {
    // Convert DB day (0=Mon) to JS day (0=Sun): jsDay = (dbDay + 1) % 7
    const jsDay = (dbDay + 1) % 7;

    // Find first occurrence on or after start
    const startJsDay = start.getUTCDay();
    const daysToAdd = (jsDay - startJsDay + 7) % 7;
    const firstMs = start.getTime() + daysToAdd * 24 * 60 * 60 * 1000;

    // Generate weekly occurrences within the window
    let currentMs = firstMs;
    while (currentMs < endMs) {
      const d = new Date(currentMs);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      results.push({ date: `${yyyy}-${mm}-${dd}`, dayOfWeek: dbDay });
      currentMs += 7 * 24 * 60 * 60 * 1000;
    }
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
