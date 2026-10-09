import nodemailer, { Transporter } from 'nodemailer';
import {
  renderOtpEmail,
  renderWelcomeEmail,
  renderTeamInviteEmail,
  renderSecurityAlertEmail,
} from '../utils/emailTemplates';

interface SendInvitationEmailParams {
  to: string;
  name?: string;
  recipientName?: string;
  inviterName?: string;
  orgName?: string;
  role?: string;
  roleName?: string;
  teamName?: string;
  temporaryPassword?: string;
  inviteUrl?: string;
  loginUrl?: string;
  expiresDays?: number;
}

interface SendOtpEmailParams {
  to: string;
  code?: string;
  otp?: string;
  purpose?: 'PASSWORD_RESET' | 'LOGIN' | 'REGISTER';
  name?: string;
  recipientName?: string;
  expiryMinutes?: number;
  expiresMinutes?: number;
  minutesExpires?: number;
}

interface SendWelcomeEmailParams {
  to: string;
  name?: string;
  recipientName?: string;
  orgName?: string;
  loginUrl?: string;
}

interface SendSecurityAlertParams {
  to: string;
  name?: string;
  recipientName?: string;
  action?: string;
  ipAddress?: string;
  device?: string;
}

class MailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  private resendApiKey: string | null = null;

  private initTransporter() {
    this.resendApiKey = process.env.RESEND_API_KEY || null;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (this.resendApiKey) {
      this.isConfigured = true;
      console.log('📬 [MailService] Configured with Resend HTTPS API');
    } else if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        pool: false,
      });
      this.isConfigured = true;
      console.log(`[MailService] Initialized SMTP transporter with host: ${host}:${port} (secure: ${secure})`);
    } else {
      console.warn('[MailService] SMTP/Resend credentials not fully provided. Emails will be logged to console.');
      this.isConfigured = false;
    }
  }

  private async sendViaResend(params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: params.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error?.message || 'Failed to send email via Resend API');
      }

      console.log(`[MailService] Email sent via Resend HTTPS API to ${params.to}. ID: ${data.id}`);
      return { success: true, messageId: data.id };
    } catch (err: any) {
      console.error(`[MailService] Resend API error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  public async verifyConnection(): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      return false;
    }
    try {
      await this.transporter.verify();
      console.log('[MailService] SMTP connection successfully verified.');
      return true;
    } catch (err: any) {
      console.error('[MailService] SMTP connection verification failed:', err.message);
      return false;
    }
  }

  /**
   * 1. Send OTP Verification Email (Registration, Login, Password Reset)
   * Rendered in Editorial Light Cream palette with zero emojis.
   */
  public async sendOtpEmail(params: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
      to,
      code = params.otp || '000000',
      purpose = 'LOGIN',
      name = params.recipientName,
      expiryMinutes = params.expiresMinutes || params.minutesExpires || 10,
    } = params;

    const fromAddress = process.env.SMTP_FROM || '"Optics" <no-reply@ivors.in>';
    const template = renderOtpEmail({ code, purpose, name, expiryMinutes });

    if (this.resendApiKey) {
      const resendRes = await this.sendViaResend({
        from: fromAddress,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      if (!resendRes.success) {
        console.warn(`[MailService FALLBACK] OTP for ${to} (${purpose}) is: ${code}`);
      }
      return resendRes;
    }

    if (!this.transporter || !this.isConfigured) {
      console.log(`[MailService SIMULATION] OTP to ${to} (${purpose}): ${code}`);
      return { success: true, messageId: `simulated-otp-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`[MailService] OTP email successfully sent to ${to} (${purpose}). MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[MailService] Failed to send OTP to ${to}:`, err.message);
      console.warn(`[MailService FALLBACK] OTP for ${to} (${purpose}) is: ${code}`);
      return { success: false, error: err.message };
    }
  }

  public async sendOtpMail(params: SendOtpEmailParams): Promise<any> {
    return this.sendOtpEmail(params);
  }

  /**
   * 2. Send Welcome Onboarding Email (Post-registration)
   * Rendered in Editorial Light Cream palette with zero emojis.
   */
  public async sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
      to,
      name = params.recipientName || 'there',
      orgName = 'Your Workspace',
      loginUrl = process.env.CLIENT_URL || 'http://localhost:3000',
    } = params;

    const fromAddress = process.env.SMTP_FROM || '"Optics" <no-reply@ivors.in>';
    const template = renderWelcomeEmail({ email: to, name, orgName, loginUrl });

    if (this.resendApiKey) {
      return this.sendViaResend({
        from: fromAddress,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    }

    if (!this.transporter || !this.isConfigured) {
      console.log(`[MailService SIMULATION] Welcome email sent to: ${to}`);
      return { success: true, messageId: `simulated-welcome-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`[MailService] Welcome email successfully sent to ${to}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[MailService] Failed to send welcome email to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  public async sendWelcomeMail(params: SendWelcomeEmailParams): Promise<any> {
    return this.sendWelcomeEmail(params);
  }

  /**
   * 3. Send Team Member Invitation Email
   * Rendered in Editorial Light Cream palette with zero emojis.
   */
  public async sendInvitationEmail(params: SendInvitationEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
      to,
      name = params.recipientName,
      inviterName = 'Your team lead',
      orgName = 'Optics Workspace',
      role = params.roleName || 'Developer',
      teamName,
      temporaryPassword,
      inviteUrl,
      loginUrl = process.env.CLIENT_URL || 'http://localhost:3000',
      expiresDays = 7,
    } = params;

    const fromAddress = process.env.SMTP_FROM || '"Optics" <no-reply@ivors.in>';
    const template = renderTeamInviteEmail({
      to,
      name,
      inviterName,
      orgName,
      role,
      teamName,
      temporaryPassword,
      inviteUrl,
      loginUrl,
      expiresDays,
    });

    if (this.resendApiKey) {
      const resendRes = await this.sendViaResend({
        from: fromAddress,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      if (!resendRes.success && inviteUrl) {
        console.warn(`[MailService FALLBACK] Invite URL for ${to} is: ${inviteUrl}`);
      }
      return resendRes;
    }

    if (!this.transporter || !this.isConfigured) {
      console.log(`[MailService SIMULATION] Invitation sent to: ${to}`);
      if (inviteUrl) console.log(`[MailService SIMULATION] Invite URL: ${inviteUrl}`);
      return { success: true, messageId: `simulated-invite-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`[MailService] Invitation email successfully sent to ${to}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[MailService] Failed to send invitation email to ${to}:`, err.message);
      if (inviteUrl) console.warn(`[MailService FALLBACK] Invite URL for ${to} is: ${inviteUrl}`);
      return { success: false, error: err.message };
    }
  }

  public async sendTeamInviteMail(params: SendInvitationEmailParams): Promise<any> {
    return this.sendInvitationEmail(params);
  }

  /**
   * 4. Send Security Alert & Password Changed Email
   * Rendered in Editorial Light Cream palette with zero emojis.
   */
  public async sendSecurityAlertMail(params: SendSecurityAlertParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
      to,
      name = params.recipientName || 'there',
      action = 'Account credentials or password updated',
      ipAddress,
      device,
    } = params;

    const fromAddress = process.env.SMTP_FROM || '"Optics" <no-reply@ivors.in>';
    const template = renderSecurityAlertEmail({
      to,
      name,
      action,
      ipAddress,
      device,
    });

    if (this.resendApiKey) {
      return this.sendViaResend({
        from: fromAddress,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    }

    if (!this.transporter || !this.isConfigured) {
      console.log(`[MailService SIMULATION] Security alert sent to: ${to} (${action})`);
      return { success: true, messageId: `simulated-security-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`[MailService] Security notice sent to ${to}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[MailService] Failed to send security alert to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  public async sendPasswordResetSuccessEmail(params: { to: string; recipientName?: string }): Promise<any> {
    return this.sendSecurityAlertMail({
      to: params.to,
      recipientName: params.recipientName,
      action: 'Account password was successfully changed',
    });
  }
}

export const mailService = new MailService();
export default mailService;
