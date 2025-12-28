export function getMonthDays(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const m = month.getMonth();

  const firstOfMonth = new Date(year, m, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  const days: Array<Date | null> = [];

  // Leading blanks for alignment
  for (let i = 0; i < startWeekday; i++) {
    days.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, m, d));
  }

  return days;
}
