import crypto from 'crypto';
import prisma from '../config/database';
import { ApiError } from '../utils/apiError';
import { mailService } from './mail.service';
import { logger } from '../utils/logger';

export type OtpPurpose = 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET';

export class OtpService {
  /**
   * Generates a cryptographically strong 6-digit OTP and sends it via email
   */
  async generateAndSendOtp(params: {
    email: string;
    purpose: OtpPurpose;
    name?: string;
    expiryMinutes?: number;
  }): Promise<{ message: string; expiryMinutes: number }> {
    const { email, purpose, name = 'there', expiryMinutes = 10 } = params;

    const normalizedEmail = email.toLowerCase().trim();

    // Invalidate any existing unused OTPs for this email & purpose
    await prisma.emailOtp.updateMany({
      where: {
        email: normalizedEmail,
        purpose,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Generate random 6-digit number
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Save in database
    await prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        code,
        purpose,
        expiresAt,
        used: false,
        attempts: 0,
      },
    });

    logger.info(`[OtpService] Generated ${purpose} OTP for ${normalizedEmail}. Expires at: ${expiresAt.toISOString()}`);

    // Dispatch email
    const mailResult = await mailService.sendOtpMail({
      to: normalizedEmail,
      code,
      purpose,
      name,
      expiryMinutes,
    });

    if (!mailResult.success) {
      logger.error(`[OtpService] Failed to dispatch ${purpose} OTP to ${normalizedEmail}`);
    }

    return {
      message: `Verification code sent to ${normalizedEmail}`,
      expiryMinutes,
    };
  }

  /**
   * Verifies an OTP code for a specific email and purpose
   */
  async verifyOtp(params: {
    email: string;
    code: string;
    purpose: OtpPurpose;
  }): Promise<boolean> {
    const { email, code, purpose } = params;
    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
        used: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw ApiError.badRequest('No active verification code found. Please request a new one.');
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.emailOtp.update({
        where: { id: otpRecord.id },
        data: { used: true },
      });
      throw ApiError.badRequest('Verification code has expired. Please request a new one.');
    }

    if (otpRecord.attempts >= 5) {
      await prisma.emailOtp.update({
        where: { id: otpRecord.id },
        data: { used: true },
      });
      throw ApiError.badRequest('Too many incorrect attempts. Please request a new verification code.');
    }

    if (otpRecord.code !== code.trim()) {
      await prisma.emailOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = 4 - otpRecord.attempts;
      throw ApiError.badRequest(`Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : ''}`);
    }

    // Mark as used
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    logger.info(`[OtpService] Successfully verified ${purpose} OTP for ${normalizedEmail}`);
    return true;
  }
}

export const otpService = new OtpService();
export default otpService;
