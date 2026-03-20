import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@agntly.io';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3100';

export interface IResendClient {
  sendMagicLink(email: string, token: string): Promise<void>;
}

export class ResendClient implements IResendClient {
  private readonly resend: Resend;

  constructor(apiKey?: string) {
    this.resend = new Resend(apiKey ?? RESEND_API_KEY);
  }

  async sendMagicLink(email: string, token: string): Promise<void> {
    const magicLinkUrl = `${FRONTEND_URL}/auth/verify?token=${token}`;

    await this.resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Sign in to Agntly',
      html: `
        <div style="font-family:'IBM Plex Mono',monospace;background:#07090d;color:#e8edf2;padding:40px;max-width:480px;margin:0 auto">
          <div style="color:#00e5a0;font-size:14px;margin-bottom:24px">● AGNTLY.IO</div>
          <h2 style="font-size:20px;font-weight:600;margin-bottom:16px">Sign in to Agntly</h2>
          <p style="color:#8fa8c0;font-size:14px;line-height:1.6;margin-bottom:24px">Click the button below to sign in. This link expires in 15 minutes.</p>
          <a href="${magicLinkUrl}" style="display:inline-block;background:#00e5a0;color:#07090d;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:500;padding:12px 28px;text-decoration:none;letter-spacing:0.04em">sign in →</a>
          <p style="color:#4d6478;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  }
}
