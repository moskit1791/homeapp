export interface ApiErrorOptions {
  details?: unknown;
  message?: string;
  status: number;
  statusText: string;
}

export class ApiError extends Error {
  readonly details?: unknown;
  readonly status: number;
  readonly statusText: string;

  constructor(options: ApiErrorOptions) {
    super(options.message ?? getApiErrorMessage(options.status, options.statusText, options.details));
    this.name = 'ApiError';
    this.details = options.details;
    this.status = options.status;
    this.statusText = options.statusText;
  }
}

export interface ApiNetworkErrorOptions {
  apiBaseUrl: string;
  cause?: unknown;
  url: string;
}

export class ApiNetworkError extends Error {
  readonly apiBaseUrl: string;
  override readonly cause?: unknown;
  readonly url: string;

  constructor(options: ApiNetworkErrorOptions) {
    super('Nie mogę połączyć się z serwerem.');
    this.name = 'ApiNetworkError';
    this.apiBaseUrl = options.apiBaseUrl;
    this.cause = options.cause;
    this.url = options.url;
  }
}

export async function createApiErrorFromResponse(response: Response): Promise<ApiError> {
  const details = await readResponseDetails(response);

  return new ApiError({
    details,
    status: response.status,
    statusText: response.statusText
  });
}

function getApiErrorMessage(status: number, statusText: string, details: unknown): string {
  const detailsMessage = extractDetailsMessage(details);

  if (detailsMessage) {
    return detailsMessage;
  }

  const fallbackMessage = getFallbackStatusMessage(status);

  if (fallbackMessage) {
    return fallbackMessage;
  }

  return statusText ? `${status} ${statusText}` : `HTTP ${status}`;
}

function getFallbackStatusMessage(status: number): string | undefined {
  if (status === 530) {
    return 'Serwer aplikacji jest chwilowo niedostępny. Spróbuj ponownie za moment.';
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'Serwer aplikacji jest chwilowo niedostępny. Spróbuj ponownie za moment.';
  }

  return undefined;
}

async function readResponseDetails(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractDetailsMessage(details: unknown): string | undefined {
  if (typeof details === 'string') {
    return details;
  }

  if (!isRecord(details)) {
    return undefined;
  }

  const message = details.message;

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string').join(', ');
  }

  if (typeof details.error === 'string') {
    return details.error;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
