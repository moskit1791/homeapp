import { ForbiddenException, NotImplementedException, UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const accessSecret = 'test-access-secret-change-me-minimum-32';
const refreshSecret = 'test-refresh-secret-change-me-minimum-32';

afterEach(() => {
  vi.unstubAllEnvs();
});

function createService() {
  vi.stubEnv('JWT_ACCESS_SECRET', accessSecret);
  vi.stubEnv('JWT_ACCESS_TTL_SECONDS', '900');
  return new AuthService({} as UsersService, createMailService());
}

function stubProductionEnv() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/homeapp_test');
  vi.stubEnv('APP_PUBLIC_URL', 'https://homeapp.example.test');
  vi.stubEnv('JWT_ACCESS_SECRET', accessSecret);
  vi.stubEnv('JWT_REFRESH_SECRET', refreshSecret);
  vi.stubEnv('MAIL_DRIVER', 'smtp');
  vi.stubEnv('SMTP_FROM', 'HomeApp <noreply@example.test>');
  vi.stubEnv('SMTP_HOST', 'smtp.example.test');
}

function createMailService() {
  return {
    sendEmailVerification: vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined)
  } as unknown as MailService;
}

describe('AuthService token verification', () => {
  it('accepts a valid local access token and returns the user id', () => {
    const service = createService();
    const token = sign({ type: 'access' }, accessSecret, {
      expiresIn: 900,
      subject: 'user-123'
    });

    expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-123' });
  });

  it('rejects tokens signed with the wrong secret', () => {
    const service = createService();
    const token = sign({ type: 'access' }, 'wrong-secret-change-me-minimum-32', {
      expiresIn: 900,
      subject: 'user-123'
    });

    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rejects non-access tokens even when the signature is valid', () => {
    const service = createService();
    const token = sign({ type: 'refresh' }, accessSecret, {
      expiresIn: 900,
      subject: 'user-123'
    });

    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });
});

describe('AuthService login and refresh policy', () => {
  it('rejects login for an unverified local email', async () => {
    const passwordHash = await hash('Password123!', 4);
    const usersService = {
      findByEmailForAuth: vi.fn().mockResolvedValue({
        accountStatus: 'inactive',
        authProviderUserId: 'provider-1',
        displayName: 'User',
        email: 'user@example.test',
        emailVerifiedAt: null,
        id: 'user-1',
        passwordHash
      })
    } as unknown as UsersService;
    const service = new AuthService(usersService, createMailService());

    await expect(
      service.login({
        email: 'user@example.test',
        password: 'Password123!'
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects login for a banned account before issuing tokens', async () => {
    const passwordHash = await hash('Password123!', 4);
    const usersService = {
      findByEmailForAuth: vi.fn().mockResolvedValue({
        accountStatus: 'banned',
        authProviderUserId: 'provider-1',
        displayName: 'User',
        email: 'user@example.test',
        emailVerifiedAt: new Date().toISOString(),
        id: 'user-1',
        passwordHash
      }),
      storeRefreshToken: vi.fn()
    } as unknown as UsersService;
    const service = new AuthService(usersService, createMailService());

    await expect(
      service.login({
        email: 'user@example.test',
        password: 'Password123!'
      })
    ).rejects.toThrow(ForbiddenException);
    expect((usersService as unknown as { storeRefreshToken: ReturnType<typeof vi.fn> }).storeRefreshToken)
      .not.toHaveBeenCalled();
  });

  it('rejects refresh for a banned account and revokes remaining refresh tokens', async () => {
    const usersService = {
      consumeRefreshToken: vi.fn().mockResolvedValue({
        accountStatus: 'banned',
        authProviderUserId: 'provider-1',
        displayName: 'User',
        email: 'user@example.test',
        id: 'user-1'
      }),
      revokeRefreshTokensForUser: vi.fn()
    } as unknown as UsersService;
    const service = new AuthService(usersService, createMailService());

    await expect(service.refresh({ refreshToken: 'opaque-refresh-token' })).rejects.toThrow(
      ForbiddenException
    );
    expect(
      (usersService as unknown as { revokeRefreshTokensForUser: ReturnType<typeof vi.fn> })
        .revokeRefreshTokensForUser
    ).toHaveBeenCalledWith('user-1');
  });
});

describe('AuthService production auth policy', () => {
  it('does not expose development verification tokens in production', async () => {
    stubProductionEnv();
    const usersService = {
      createLocalUser: vi.fn().mockResolvedValue({
        accountStatus: 'inactive',
        authProviderUserId: 'provider-1',
        displayName: 'User',
        email: 'user@example.test',
        id: 'user-1'
      })
    } as unknown as UsersService;
    const mailService = createMailService();
    const service = new AuthService(usersService, mailService);

    const response = await service.register({
      displayName: 'User',
      email: 'user@example.test',
      password: 'Password123!'
    });

    expect('devVerificationToken' in response).toBe(false);
    expect(mailService.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'User',
        email: 'user@example.test'
      })
    );
  });

  it('does not expose development reset tokens in production', async () => {
    stubProductionEnv();
    const usersService = {
      setPasswordResetToken: vi.fn().mockResolvedValue({
        displayName: 'User',
        email: 'user@example.test'
      })
    } as unknown as UsersService;
    const mailService = createMailService();
    const service = new AuthService(usersService, mailService);

    const response = await service.forgotPassword({ email: 'user@example.test' });

    expect(response).toEqual({ ok: true });
    expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'User',
        email: 'user@example.test'
      })
    );
  });

  it('requires Google OAuth configuration before accepting Google login', async () => {
    const service = createService();

    await expect(service.loginWithGoogle({ idToken: 'token' })).rejects.toThrow(
      NotImplementedException
    );
  });
});
