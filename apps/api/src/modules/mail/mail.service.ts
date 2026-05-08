import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { AppEnv, loadEnv } from '../../shared/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  async sendEmailVerification(input: AuthMailInput): Promise<void> {
    const env = loadEnv();
    const link = this.buildPublicAuthLink(env, 'verify-email', {
      email: input.email,
      token: input.token
    });

    await this.send(env, {
      html: [
        `<p>Czesc ${escapeHtml(input.displayName)},</p>`,
        '<p>Potwierdz adres e-mail, aby aktywowac konto w HomeApp.</p>',
        this.buttonLink(link, 'Potwierdz konto'),
        `<p>Jesli przycisk nie dziala, skopiuj ten link: ${escapeHtml(link)}</p>`
      ].join(''),
      subject: 'Potwierdz konto w HomeApp',
      text: [
        `Czesc ${input.displayName},`,
        'Potwierdz adres e-mail, aby aktywowac konto w HomeApp.',
        link
      ].join('\n\n'),
      to: input.email
    });
  }

  async sendPasswordReset(input: AuthMailInput): Promise<void> {
    const env = loadEnv();
    const link = this.buildPublicAuthLink(env, 'reset-password', {
      token: input.token
    });

    await this.send(env, {
      html: [
        `<p>Czesc ${escapeHtml(input.displayName)},</p>`,
        '<p>Otrzymalismy prosbe o reset hasla do HomeApp.</p>',
        this.buttonLink(link, 'Ustaw nowe haslo'),
        '<p>Link wygasa po 1 godzinie. Jesli to nie Ty, zignoruj ta wiadomosc.</p>',
        `<p>Jesli przycisk nie dziala, skopiuj ten link: ${escapeHtml(link)}</p>`
      ].join(''),
      subject: 'Reset hasla HomeApp',
      text: [
        `Czesc ${input.displayName},`,
        'Otrzymalismy prosbe o reset hasla do HomeApp.',
        'Link wygasa po 1 godzinie. Jesli to nie Ty, zignoruj ta wiadomosc.',
        link
      ].join('\n\n'),
      to: input.email
    });
  }

  async sendHouseholdInvitation(input: HouseholdInvitationMailInput): Promise<void> {
    const env = loadEnv();
    const link = this.buildPublicAuthLink(env, 'invitation', {
      token: input.token
    });

    await this.send(env, {
      html: [
        `<p>Czesc,</p>`,
        `<p>${escapeHtml(input.invitedByDisplayName)} zaprasza Cie do domu "${escapeHtml(input.householdName)}" w HomeApp.</p>`,
        this.buttonLink(link, 'Dolacz do domu'),
        '<p>Link wygasa po 7 dniach. Zaloguj sie kontem z adresem, na ktory przyszlo zaproszenie.</p>',
        `<p>Jesli przycisk nie dziala, skopiuj ten link: ${escapeHtml(link)}</p>`
      ].join(''),
      subject: `Zaproszenie do domu ${input.householdName} w HomeApp`,
      text: [
        'Czesc,',
        `${input.invitedByDisplayName} zaprasza Cie do domu "${input.householdName}" w HomeApp.`,
        'Link wygasa po 7 dniach. Zaloguj sie kontem z adresem, na ktory przyszlo zaproszenie.',
        link
      ].join('\n\n'),
      to: input.email
    });
  }

  private async send(env: AppEnv, message: OutboundMail): Promise<void> {
    if (env.MAIL_DRIVER === 'console') {
      this.logger.log(`Console mail to ${message.to}: ${message.subject}`);
      this.logger.debug(message.text);
      return;
    }

    try {
      await this.getTransporter(env).sendMail({
        from: env.SMTP_FROM,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to
      });
    } catch (error) {
      this.logger.error(
        `Failed to send mail to ${message.to}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new ServiceUnavailableException('Email delivery failed');
    }
  }

  private getTransporter(env: AppEnv): Transporter {
    if (!env.SMTP_HOST) {
      throw new ServiceUnavailableException('SMTP_HOST is not configured');
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        auth: env.SMTP_USER && env.SMTP_PASSWORD
          ? {
              pass: env.SMTP_PASSWORD,
              user: env.SMTP_USER
            }
          : undefined,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE
      });
    }

    return this.transporter;
  }

  private buildLink(baseUrl: string, path: string, params: Record<string, string>): string {
    const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private buildPublicAuthLink(
    env: AppEnv,
    action: 'invitation' | 'reset-password' | 'verify-email',
    params: Record<string, string>
  ): string {
    return this.buildLink(env.APP_PUBLIC_URL, `/api/auth/open/${action}`, params);
  }

  private buttonLink(link: string, label: string): string {
    return [
      '<p>',
      `<a href="${escapeHtml(link)}" style="background:#0b7a2a;border-radius:8px;color:#ffffff;display:inline-block;font-weight:700;padding:12px 18px;text-decoration:none;">`,
      escapeHtml(label),
      '</a>',
      '</p>'
    ].join('');
  }
}

interface AuthMailInput {
  displayName: string;
  email: string;
  token: string;
}

interface HouseholdInvitationMailInput {
  email: string;
  householdName: string;
  invitedByDisplayName: string;
  token: string;
}

interface OutboundMail {
  html: string;
  subject: string;
  text: string;
  to: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
