const DEFAULT_API_BASE_URL = "https://app.porabkihome.pl/api";

function normalizeApiBaseUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, "");

  try {
    new URL(normalized, window.location.origin);
  } catch {
    throw new Error(`Nieprawidłowy adres API: ${normalized}`);
  }

  return normalized;
}

export const apiBaseUrl = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL,
);

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function buildApiUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
