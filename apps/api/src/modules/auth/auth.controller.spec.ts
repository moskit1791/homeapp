import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

afterEach(() => vi.unstubAllEnvs());

describe('public authentication links', () => {
  const controller = new AuthController({} as AuthService);

  it.each(['verify-email', 'reset-password', 'invitation'])(
    'opens %s on the configured web domain and preserves encoded parameters',
    (action) => {
      vi.stubEnv('AUTH_LINK_BASE_URL', 'https://app.porabkihome.pl/auth/');
      const result = controller.openAuthLink(action, 'test+home@example.com', 'a+b/c=');
      const url = new URL(result.url);
      expect(url.origin).toBe('https://app.porabkihome.pl');
      expect(url.pathname).toBe(`/auth/${action}`);
      expect(url.searchParams.get('email')).toBe('test+home@example.com');
      expect(url.searchParams.get('token')).toBe('a+b/c=');
    }
  );

  it('retains support for mobile deep links and rejects arbitrary actions', () => {
    vi.stubEnv('AUTH_LINK_BASE_URL', 'homeapp://auth');
    expect(controller.openAuthLink('https://untrusted.example').url).toBe('homeapp://auth/invitation');
  });
});
