export function parsePositiveMoney(
  value: string | null | undefined,
): number | null {
  const normalized = value?.replace(/\s/g, "").replace(",", ".").trim() ?? "";
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function requirePositiveMoney(
  value: string | null | undefined,
): number {
  const amount = parsePositiveMoney(value);
  if (amount === null) throw new Error("Nieprawidłowa kwota wydatku.");
  return amount;
}
