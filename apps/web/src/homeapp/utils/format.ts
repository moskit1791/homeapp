export function money(value: string | number | null | undefined, currency = 'PLN'): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(
    Number.isFinite(amount) ? amount : 0
  );
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pl-PL', {
        day: '2-digit',
        month: 'short',
      }).format(date);
}

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function monthCalendarDays(date: Date): Array<number | null> {
  const firstDayOffset = (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDayOffset + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
}

function localIso(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0'))
    .join('-');
}

export function calendarMonthDates(month: string): string[] {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1, 12);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(year, monthNumber, 0, 12);
  last.setDate(last.getDate() + ((7 - last.getDay()) % 7));
  const dayCount = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return localIso(date);
  });
}

export function calendarWeekDates(value: string): string[] {
  const first = new Date(`${value}T12:00:00`);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return localIso(date);
  });
}

export function weekStartIso(): string {
  const now = new Date(`${todayIso()}T12:00:00`);
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return now.toISOString().slice(0, 10);
}
