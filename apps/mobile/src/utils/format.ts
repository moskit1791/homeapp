export function formatMoney(value: number | string | null | undefined, currency = 'zl'): string {
  const amount = Number(value ?? 0);

  return `${amount.toLocaleString('pl-PL', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${currency}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  const [year, month, day] = value.slice(0, 10).split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);

  monday.setDate(today.getDate() + diff);

  return monday.toISOString().slice(0, 10);
}

export function getNextMonthDate(value = getTodayDate()): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  date.setUTCMonth(date.getUTCMonth() + 1);

  return date.toISOString().slice(0, 10);
}
