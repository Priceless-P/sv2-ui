const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Format a YYYY-MM-DD work day in the same long UTC form used by the canonical table. */
export function formatUtcDay(workDay: string): string {
  const iso = (workDay ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return workDay || '—';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return iso;
  return `${WEEKDAYS[date.getUTCDay()]} ${day} ${MONTHS[month - 1]} ${year}`;
}

