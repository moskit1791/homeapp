import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotImplementedException,
  UnauthorizedException
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes, createHash } from 'node:crypto';
import { sign, verify } from 'jsonwebtoken';
import { AppEnv, loadEnv } from '../../shared/env';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import {
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const displayName = this.normalizeText(dto.displayName);
    const passwordHash = await hash(dto.password, 12);
    const verificationToken = this.createOpaqueToken();
    const user = await this.usersService.createLocalUser({
      displayName,
      email,
      emailVerificationTokenHash: this.hashToken(verificationToken),
      passwordHash
    });

    await this.mailService.sendEmailVerification({
      displayName,
      email,
      token: verificationToken
    });

    return {
      ...(this.shouldExposeDevTokens(loadEnv()) ? { devVerificationToken: verificationToken } : {}),
      user
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailForAuth(this.normalizeEmail(dto.email));

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.accountStatus === 'banned') {
      throw new ForbiddenException('Account is banned');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email is not verified');
    }

    const validPassword = await compare(dto.password, user.passwordHash);

    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user.id);
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    const env = loadEnv();

    if (!env.GOOGLE_OAUTH_CLIENT_ID) {
      throw new NotImplementedException('Google OAuth requires GOOGLE_OAUTH_CLIENT_ID');
    }

    const payload = await this.verifyGoogleIdToken(dto.idToken, env.GOOGLE_OAUTH_CLIENT_ID);
    const email = this.normalizeEmail(payload.email);
    const displayName = this.normalizeText(payload.name || (email.split('@')[0] ?? email));
    const user = await this.usersService.upsertGoogleUser({
      displayName,
      email,
      googleSubject: payload.sub
    });

    if (user.accountStatus === 'banned') {
      throw new ForbiddenException('Account is banned');
    }

    return this.issueSession(user.id);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const resetToken = this.createOpaqueToken();
    const user = await this.usersService.setPasswordResetToken(email, this.hashToken(resetToken));

    if (user) {
      await this.mailService.sendPasswordReset({
        displayName: user.displayName,
        email: user.email,
        token: resetToken
      });
    }

    return {
      ...(user && this.shouldExposeDevTokens(loadEnv()) ? { devResetToken: resetToken } : {}),
      ok: true
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordHash = await hash(dto.password, 12);
    const changed = await this.usersService.resetPassword(this.hashToken(dto.token), passwordHash);

    if (!changed) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    return { ok: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const verified = await this.usersService.verifyEmail(
      this.normalizeEmail(dto.email),
      this.hashToken(dto.token)
    );

    if (!verified) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    return { ok: true };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = this.normalizeEmail(dto.email);
    const verificationToken = this.createOpaqueToken();
    const user = await this.usersService.setEmailVerificationToken(
      email,
      this.hashToken(verificationToken)
    );

    if (user) {
      await this.mailService.sendEmailVerification({
        displayName: user.displayName,
        email: user.email,
        token: verificationToken
      });
    }

    return {
      ...(user && this.shouldExposeDevTokens(loadEnv())
        ? { devVerificationToken: verificationToken }
        : {}),
      ok: true
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    const user = await this.usersService.consumeRefreshToken(tokenHash);

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (user.accountStatus === 'banned') {
      await this.usersService.revokeRefreshTokensForUser(user.id);
      throw new ForbiddenException('Account is banned');
    }

    return this.issueSession(user.id);
  }

  async logout(accessToken: string) {
    const payload = this.verifyAccessToken(accessToken);
    await this.usersService.revokeRefreshTokensForUser(payload.userId);

    return { ok: true };
  }

  async deleteAccount(accessToken: string) {
    const payload = this.verifyAccessToken(accessToken);
    await this.usersService.deleteAccount(payload.userId);

    return { ok: true };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const env = loadEnv();

    try {
      const payload = verify(token, env.JWT_ACCESS_SECRET);

      if (
        typeof payload === 'object' &&
        payload.type === 'access' &&
        typeof payload.sub === 'string'
      ) {
        return {
          userId: payload.sub
        };
      }
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    throw new UnauthorizedException('Invalid access token');
  }

  private async issueSession(userId: string) {
    const env = loadEnv();
    const refreshToken = this.createOpaqueToken();
    const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);
    await this.usersService.storeRefreshToken({
      expiresAt: refreshExpiresAt,
      tokenHash: this.hashToken(refreshToken),
      userId
    });

    return {
      accessToken: sign(
        {
          type: 'access'
        },
        env.JWT_ACCESS_SECRET,
        {
          expiresIn: env.JWT_ACCESS_TTL_SECONDS,
          subject: userId
        }
      ),
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString()
    };
  }

  private createOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeText(value: string): string {
    return value.trim();
  }

  private shouldExposeDevTokens(env: AppEnv): boolean {
    return env.NODE_ENV !== 'production';
  }

  private async verifyGoogleIdToken(
    idToken: string,
    audience: string
  ): Promise<GoogleIdentityPayload> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        audience,
        idToken
      });
      const payload = ticket.getPayload();

      if (
        payload?.sub &&
        payload.email &&
        payload.email_verified === true
      ) {
        return {
          email: payload.email,
          name: payload.name,
          sub: payload.sub
        };
      }
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    throw new UnauthorizedException('Invalid Google token');
  }
}

export interface AccessTokenPayload {
  userId: string;
}

interface GoogleIdentityPayload {
  email: string;
  name?: string;
  sub: string;
}
