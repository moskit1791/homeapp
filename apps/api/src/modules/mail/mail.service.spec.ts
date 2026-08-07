import nodemailer from 'nodemailer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn()
  }
}));

describe('MailService', () => {
  const sendMail = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.stubEnv('APP_PUBLIC_URL', 'https://homeapp.example.test');
    vi.stubEnv('MAIL_DRIVER', 'smtp');
    vi.stubEnv('SMTP_HOST', 'smtp.example.test');
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('uses correct Polish characters in email verification messages', async () => {
    const service = new MailService();

    await service.sendEmailVerification({
      displayName: 'Łukasz',
      email: 'lukasz@example.test',
      token: 'verification-token'
    });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('Cześć Łukasz'),
      subject: 'Potwierdź konto w HomeApp',
      text: expect.stringContaining('Potwierdź adres e-mail, aby aktywować konto w HomeApp.')
    }));
  });

  it('uses correct Polish characters in password reset messages', async () => {
    const service = new MailService();

    await service.sendPasswordReset({
      displayName: 'Michał',
      email: 'michal@example.test',
      token: 'reset-token'
    });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('Jeśli to nie Ty, zignoruj tę wiadomość.'),
      subject: 'Reset hasła HomeApp',
      text: expect.stringContaining('Otrzymaliśmy prośbę o reset hasła do HomeApp.')
    }));
  });

  it('uses correct Polish characters in household invitation messages', async () => {
    const service = new MailService();

    await service.sendHouseholdInvitation({
      email: 'guest@example.test',
      householdName: 'Nasz dom',
      invitedByDisplayName: 'Małgorzata',
      token: 'invitation-token'
    });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('Małgorzata zaprasza Cię do domu'),
      subject: 'Zaproszenie do domu Nasz dom w HomeApp',
      text: expect.stringContaining('Otworzy widok dołączenia do domu, gdzie ustawisz hasło')
    }));
  });
});
