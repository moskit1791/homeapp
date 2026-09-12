import { buildApiUrl, getApiBaseUrl } from './config';
import { ApiNetworkError, createApiErrorFromResponse } from './errors';
import { prepareEncryptedApiBody, transformEncryptedApiResponse } from '../encryption-runtime';

export type ApiMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export interface ApiRequestOptions<TBody = unknown> {
  accessToken?: string | null;
  body?: TBody;
  headers?: Record<string, string>;
  method?: ApiMethod;
  signal?: AbortSignal;
}

type ApiAuthRefreshHandler = (failedAccessToken: string) => Promise<string | null>;

let authRefreshHandler: ApiAuthRefreshHandler | null = null;

export function setApiAuthRefreshHandler(handler: ApiAuthRefreshHandler | null) {
  authRefreshHandler = handler;
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
    method: options.method ?? 'GET',
    signal: options.signal,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    request.body = JSON.stringify(
      await prepareEncryptedApiBody(path, request.method ?? 'GET', options.body)
    );
  }

  const send = async (accessToken?: string | null) => {
    try {
      return await fetch(buildApiUrl(path), {
        ...request,
        headers: {
          ...headers,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
    } catch (cause) {
      throw new ApiNetworkError({
        apiBaseUrl: getApiBaseUrl(),
        cause,
        url: buildApiUrl(path),
      });
    }
  };

  let response = await send(options.accessToken);
  if (response.status === 401 && options.accessToken && authRefreshHandler) {
    const refreshedAccessToken = await authRefreshHandler(options.accessToken);
    if (refreshedAccessToken) response = await send(refreshedAccessToken);
  }

  if (!response.ok) throw await createApiErrorFromResponse(response);
  if (response.status === 204) return undefined as TResponse;

  const text = await response.text();
  return text
    ? transformEncryptedApiResponse(JSON.parse(text) as TResponse)
    : (undefined as TResponse);
}
