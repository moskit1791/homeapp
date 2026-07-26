export function parsePositiveMoney(
  value: string | null | undefined,
): number | null {
  const normalized = value?.replace(/\s/g, "").replace(",", ".").trim() ?? "";
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function requirePositiveMoney(value: string | null | undefined): number {
  const amount = parsePositiveMoney(value);
  if (amount === null) throw new Error("Nieprawidłowa kwota wydatku.");
  return amount;
}

export function formatSourceAmountCurrency(
  amount: string | null,
  currency: string | null,
): string {
  return [amount?.trim(), currency?.trim().toUpperCase()]
    .filter(Boolean)
    .join(" ");
}

export function parseSourceAmountCurrency(value: string): {
  amount: number;
  amountText: string;
  currency: string;
} | null {
  const match = value.trim().match(/^(.+?)\s+([A-Za-z]{3})$/);
  if (!match) return null;
  const amountPart = match[1];
  const currencyPart = match[2];
  if (!amountPart || !currencyPart) return null;

  const amountText = amountPart.trim().replace(",", ".");
  const amount = parsePositiveMoney(amountText);
  if (amount === null) return null;

  return {
    amount,
    amountText,
    currency: currencyPart.toUpperCase(),
  };
}
