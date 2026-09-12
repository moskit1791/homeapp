import { it, vi, expect, describe, afterEach } from 'vitest';

import { ApiError } from './errors';
import { apiRequest, setApiAuthRefreshHandler } from './request';

describe('apiRequest authentication refresh', () => {
  afterEach(() => {
    setApiAuthRefreshHandler(null);
    vi.unstubAllGlobals();
  });

  it('refreshes an expired access token and retries the request once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"expired"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const refresh = vi.fn().mockResolvedValue('fresh-token');
    vi.stubGlobal('fetch', fetchMock);
    setApiAuthRefreshHandler(refresh);

    await expect(
      apiRequest<{ ok: boolean }>('/protected', { accessToken: 'expired-token' })
    ).resolves.toEqual({ ok: true });

    expect(refresh).toHaveBeenCalledWith('expired-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer expired-token',
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer fresh-token',
    });
  });

  it('does not loop when the retried request is still unauthorized', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"message":"unauthorized"}', { status: 401 }));
    const refresh = vi.fn().mockResolvedValue('fresh-token');
    vi.stubGlobal('fetch', fetchMock);
    setApiAuthRefreshHandler(refresh);

    await expect(apiRequest('/protected', { accessToken: 'expired-token' })).rejects.toBeInstanceOf(
      ApiError
    );

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
