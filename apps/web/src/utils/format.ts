export function money(
  value: string | number | null | undefined,
  currency = "PLN",
): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pl-PL", {
        day: "2-digit",
        month: "short",
      }).format(date);
}

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function weekStartIso(): string {
  const now = new Date(`${todayIso()}T12:00:00`);
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return now.toISOString().slice(0, 10);
}
