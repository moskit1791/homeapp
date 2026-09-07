import { buildApiUrl, getApiBaseUrl } from './config';
import { ApiNetworkError, createApiErrorFromResponse } from './errors';

export type ApiMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export interface ApiRequestOptions<TBody = unknown> {
  accessToken?: string | null;
  body?: TBody;
  headers?: Record<string, string>;
  method?: ApiMethod;
  signal?: AbortSignal;
}

export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {}
): Promise<TResponse> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  const request: RequestInit = {
    headers,
    method: options.method ?? 'GET',
    signal: options.signal,
  };

  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    request.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), request);
  } catch (cause) {
    throw new ApiNetworkError({
      apiBaseUrl: getApiBaseUrl(),
      cause,
      url: buildApiUrl(path),
    });
  }

  if (!response.ok) throw await createApiErrorFromResponse(response);
  if (response.status === 204) return undefined as TResponse;

  const text = await response.text();
  return text ? (JSON.parse(text) as TResponse) : (undefined as TResponse);
}
