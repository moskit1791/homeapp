import Constants from 'expo-constants';

const DEFAULT_API_BASE_URL = 'https://app.porabkihome.pl/api';

function readConfiguredApiBaseUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const configuredUrl = extra?.apiUrl ?? readEnvApiBaseUrl();

  return configuredUrl?.trim() ? configuredUrl.trim() : undefined;
}

function readEnvApiBaseUrl(): string | undefined {
  const maybeProcess = (globalThis as {
    process?: { env?: { EXPO_PUBLIC_API_URL?: string } };
  }).process;

  return maybeProcess?.env?.EXPO_PUBLIC_API_URL;
}

function normalizeApiBaseUrl(url: string): string {
  const normalizedUrl = url.replace(/\/+$/, '');

  try {
    new URL(normalizedUrl);
  } catch {
    throw new Error(`Invalid API base URL: ${normalizedUrl}`);
  }

  return normalizedUrl;
}

export const apiBaseUrl = normalizeApiBaseUrl(
  readConfiguredApiBaseUrl() ?? DEFAULT_API_BASE_URL
);

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${apiBaseUrl}${normalizedPath}`;
}
