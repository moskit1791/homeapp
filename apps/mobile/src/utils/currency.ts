export type SupportedCurrencyCode = "PLN" | "EUR" | "GBP";

export const currencyOptions: Array<{
  label: string;
  name: string;
  symbol: string;
  value: SupportedCurrencyCode;
}> = [
  { label: "PLN zł", name: "Złoty", symbol: "zł", value: "PLN" },
  { label: "EUR €", name: "Euro", symbol: "€", value: "EUR" },
  { label: "GBP £", name: "Funt", symbol: "£", value: "GBP" },
];

const currencySymbols: Record<SupportedCurrencyCode, string> = {
  EUR: "€",
  GBP: "£",
  PLN: "zł",
};

export function normalizeCurrencyCode(value: string | null | undefined): SupportedCurrencyCode {
  const normalized = value?.trim().toUpperCase();

  if (normalized === "EUR" || normalized === "GBP" || normalized === "PLN") {
    return normalized;
  }

  return "PLN";
}

export function getCurrencySymbol(value: string | null | undefined): string {
  return currencySymbols[normalizeCurrencyCode(value)];
}

export function formatCurrencyAmount(
  value: string | number | null | undefined,
  currencyCode: string | null | undefined,
): string {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `${safeAmount.toLocaleString("pl-PL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(safeAmount) ? 0 : 2,
  })} ${getCurrencySymbol(currencyCode)}`;
}
