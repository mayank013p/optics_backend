import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import config from '../config';
import { ApiError } from '../utils/apiError';
import { mailService } from './mail.service';
import { otpService, OtpPurpose } from './otp.service';

export class AuthService {
  /**
   * Primary Password Registration (automatically dispatches a welcome email)
   */
  async register(params: { email: string; password: string; name: string; orgName?: string }) {
    const { email, password, name, orgName } = params;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw ApiError.badRequest('User already exists with this email');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name,
        emailVerified: true,
      },
    });

    const finalOrgName = orgName || `${name.split(' ')[0]}'s Workspace`;
    const orgSlug =
      finalOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

    let ownerRole = await prisma.role.findFirst({ where: { name: 'Organization Owner' } });
    if (!ownerRole) {
      ownerRole = await prisma.role.create({
        data: {
          name: 'Organization Owner',
          description: 'Full administrative access to all workspaces and projects',
          isSystem: true,
        },
      });
    }

    const org = await prisma.organization.create({
      data: {
        name: finalOrgName,
        slug: orgSlug,
        members: {
          create: {
            userId: user.id,
            roleId: ownerRole.id,
          },
        },
        workspaces: {
          create: {
            name: 'Primary Workspace',
            slug: 'primary',
            members: {
              create: {
                userId: user.id,
                roleId: ownerRole.id,
              },
            },
          },
        },
      },
      include: {
        workspaces: true,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    // Send beautiful welcome onboarding email
    mailService
      .sendWelcomeMail({
        to: user.email,
        name: user.name,
        orgName: finalOrgName,
      })
      .catch((err) => {
        console.error('[AuthService] Welcome email dispatch error:', err);
      });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: org,
      workspace: org.workspaces[0],
    };
  }

  /**
   * Primary Password Login
   */
  async login(params: { email: string; password: string }) {
    const { email, password } = params;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                workspaces: true,
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organizations: user.organizationMembers.map((m) => ({
        ...m.organization,
        role: m.role.name,
      })),
    };
  }

  /**
   * Request OTP for Login or Registration
   */
  async requestOtp(params: { email: string; purpose: OtpPurpose }) {
    const { email, purpose } = params;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (purpose === 'LOGIN') {
      if (!existingUser) {
        throw ApiError.notFound('No account found with this email. Please register first.');
      }
      return otpService.generateAndSendOtp({
        email: normalizedEmail,
        purpose: 'LOGIN',
        name: existingUser.name,
      });
    }

    if (purpose === 'REGISTER') {
      if (existingUser) {
        throw ApiError.badRequest('An account already exists with this email. Please log in.');
      }
      return otpService.generateAndSendOtp({
        email: normalizedEmail,
        purpose: 'REGISTER',
      });
    }

    if (purpose === 'PASSWORD_RESET') {
      if (!existingUser) {
        throw ApiError.notFound('No account found with this email address.');
      }
      return otpService.generateAndSendOtp({
        email: normalizedEmail,
        purpose: 'PASSWORD_RESET',
        name: existingUser.name,
      });
    }

    return otpService.generateAndSendOtp({
      email: normalizedEmail,
      purpose,
      name: existingUser?.name,
    });
  }

  /**
   * Reset Password via OTP code
   */
  async resetPasswordWithOtp(params: {
    email: string;
    code: string;
    newPassword: string;
    ipAddress?: string;
    device?: string;
  }) {
    const { email, code, newPassword, ipAddress, device } = params;
    const normalizedEmail = email.toLowerCase().trim();

    if (!newPassword || newPassword.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters long');
    }

    // Verify OTP code specifically for PASSWORD_RESET
    await otpService.verifyOtp({
      email: normalizedEmail,
      code,
      purpose: 'PASSWORD_RESET',
    });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw ApiError.notFound('Account not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Send security alert email
    mailService
      .sendSecurityAlertMail({
        to: user.email,
        name: user.name,
        action: 'Account password was successfully reset via OTP verification',
        ipAddress,
        device,
      })
      .catch((err) => console.error('[AuthService] Security alert error:', err));

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  }

  /**
   * 2nd Authentication Method: Login via OTP code
   */
  async loginWithOtp(params: { email: string; code: string }) {
    const { email, code } = params;
    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP code
    await otpService.verifyOtp({
      email: normalizedEmail,
      code,
      purpose: 'LOGIN',
    });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                workspaces: true,
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('Account not found');
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organizations: user.organizationMembers.map((m) => ({
        ...m.organization,
        role: m.role.name,
      })),
    };
  }

  /**
   * Register with Email OTP Verification
   */
  async registerWithOtp(params: {
    email: string;
    code: string;
    password: string;
    name: string;
    orgName?: string;
  }) {
    const { email, code, password, name, orgName } = params;
    const normalizedEmail = email.toLowerCase().trim();

    // Verify the register OTP
    await otpService.verifyOtp({
      email: normalizedEmail,
      code,
      purpose: 'REGISTER',
    });

    // Complete registration
    return this.register({
      email: normalizedEmail,
      password,
      name,
      orgName,
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        jobTitle: true,
        emailVerified: true,
        organizationMembers: {
          include: {
            organization: {
              include: {
                workspaces: {
                  include: {
                    projects: true,
                  },
                },
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string; jobTitle?: string | null; avatarUrl?: string | null }) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name ? String(data.name) : undefined,
        jobTitle: data.jobTitle !== undefined ? (data.jobTitle ? String(data.jobTitle) : null) : undefined,
        avatarUrl: data.avatarUrl !== undefined ? (data.avatarUrl ? String(data.avatarUrl) : null) : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        jobTitle: true,
      },
    });

    return updatedUser;
  }

  async updatePassword(
    userId: string,
    params: { currentPassword?: string; newPassword: string; ipAddress?: string; device?: string }
  ) {
    const { currentPassword, newPassword, ipAddress, device } = params;

    if (!newPassword || newPassword.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        throw ApiError.badRequest('Current password is incorrect');
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Send security alert email for password update
    mailService
      .sendSecurityAlertMail({
        to: user.email,
        name: user.name,
        action: 'Account password was updated',
        ipAddress,
        device,
      })
      .catch((err) => console.error('[AuthService] Security alert error:', err));

    return { success: true, message: 'Password updated successfully' };
  }
}

export const authService = new AuthService();
