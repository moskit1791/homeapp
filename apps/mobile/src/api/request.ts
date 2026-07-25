import { buildApiUrl, getApiBaseUrl } from './config';
import { ApiNetworkError, createApiErrorFromResponse } from './errors';
import {
  prepareEncryptedApiBody,
  transformEncryptedApiResponse
} from '../encryption/runtime-transport';

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
    ...options.headers
  };
  const requestInit: RequestInit = {
    headers,
    method: options.method ?? 'GET',
    signal: options.signal
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    requestInit.body = JSON.stringify(
      await prepareEncryptedApiBody(path, requestInit.method ?? 'GET', options.body)
    );
  }

  const url = buildApiUrl(path);
  let response: Response;

  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    console.warn('API network request failed', {
      apiBaseUrl: getApiBaseUrl(),
      method: requestInit.method,
      path,
      url
    });

    throw new ApiNetworkError({
      apiBaseUrl: getApiBaseUrl(),
      cause: error,
      url
    });
  }

  if (!response.ok) {
    throw await createApiErrorFromResponse(response);
  }

  return transformEncryptedApiResponse(await readJsonResponse<TResponse>(response));
}

async function readJsonResponse<TResponse>(response: Response): Promise<TResponse> {
  if (response.status === 204) {
    return undefined as TResponse;
  }

  const text = await response.text();

  if (!text) {
    return undefined as TResponse;
  }

  return JSON.parse(text) as TResponse;
}
