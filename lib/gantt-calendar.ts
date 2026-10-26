type DayInfo = { off: boolean; label: string; confirmed: boolean };
const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
export function buildGanttCalendar(range: { start: number; end: number }, cell: number, scale: string, today: number, calendarDay: (date: string) => DayInfo) {
  const months: { label: string; left: number; width: number }[] = [];
  const ticks: { label: string; sub: string; left: number; width: number; today: boolean; off: boolean; title: string }[] = [];
  const segments: string[] = [];
  let previousMonth = "", offStart: number | null = null, unconfirmed = false;
  for (let d = range.start; d <= range.end + 1; d++) {
    const dt = new Date(d * 86400000), date = dt.toISOString().slice(0, 10);
    const info = d <= range.end ? calendarDay(date) : { off: false, label: "", confirmed: true };
    if (!info.confirmed) unconfirmed = true;
    if (info.off) offStart ??= d;
    else if (offStart !== null) {
      const from = (offStart - range.start) * cell, to = (d - range.start) * cell;
      segments.push(`transparent ${from}px, var(--st-weekend) ${from}px, var(--st-weekend) ${to}px, transparent ${to}px`);
      offStart = null;
    }
    if (d > range.end) break;
    const month = date.slice(0, 7);
    if (month === previousMonth) months[months.length - 1].width += cell;
    else { months.push({ label: monthFormatter.format(dt), left: (d - range.start) * cell, width: cell }); previousMonth = month; }
    if (scale === "day" || (scale === "week" && dt.getUTCDay() === 1) || (scale === "month" && dt.getUTCDate() === 1)) {
      ticks.push({ label: String(dt.getUTCDate()), sub: scale === "day" ? weekdays[dt.getUTCDay()] : date.slice(8, 10) + "." + date.slice(5, 7),
        left: (d - range.start) * cell, width: scale === "day" ? cell : scale === "week" ? 7 * cell : new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate() * cell,
        today: d === today, off: scale === "day" && info.off, title: `${date} · ${info.label}` });
    }
  }
  return { months, ticks, unconfirmed, background: segments.length ? `linear-gradient(to right, ${segments.join(", ")})` : "none" };
}
