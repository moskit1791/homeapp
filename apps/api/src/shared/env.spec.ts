import { describe, expect, it, vi, afterEach } from 'vitest';
import { loadEnv } from './env';

const productionBaseEnv = {
  APP_PUBLIC_URL: 'https://homeapp.example.test',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/homeapp_prod',
  JWT_ACCESS_SECRET: 'prod-access-secret-change-me-minimum-32',
  JWT_REFRESH_SECRET: 'prod-refresh-secret-change-me-minimum-32',
  MAIL_DRIVER: 'smtp',
  NODE_ENV: 'production',
  SMTP_FROM: 'HomeApp <noreply@example.test>',
  SMTP_HOST: 'smtp.example.test'
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('loadEnv', () => {
  it('rejects unsafe production defaults', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => loadEnv()).toThrow();
  });

  it('accepts explicit production secrets and public URL', () => {
    for (const [key, value] of Object.entries(productionBaseEnv)) {
      vi.stubEnv(key, value);
    }

    expect(loadEnv()).toMatchObject(productionBaseEnv);
  });

  it('rejects incomplete SMTP credentials', () => {
    vi.stubEnv('SMTP_USER', 'user@example.test');

    expect(() => loadEnv()).toThrow();
  });

  it('treats blank optional integration variables as unset', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_IDS', '');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_PASSWORD', '');
    vi.stubEnv('SMTP_USER', '');

    expect(loadEnv()).toMatchObject({
      GEMINI_API_KEY: undefined,
      GOOGLE_OAUTH_CLIENT_ID: undefined,
      GOOGLE_OAUTH_CLIENT_IDS: undefined,
      SMTP_HOST: undefined,
      SMTP_PASSWORD: undefined,
      SMTP_USER: undefined
    });
  });

  it('parses multiple Google OAuth audiences from a comma-separated variable', () => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_IDS', ' android-client , web-client ,, ');

    expect(loadEnv()).toMatchObject({
      GOOGLE_OAUTH_CLIENT_IDS: ['android-client', 'web-client']
    });
  });
});
