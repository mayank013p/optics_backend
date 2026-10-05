import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { ApiError } from '../utils/apiError';
import { mailService } from './mail.service';
import config from '../config';

export class TeamService {
  async listMembers() {
    const orgMembers = await prisma.organizationMember.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
          },
        },
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return orgMembers.map((m) => ({
      user: m.user,
      role: m.role.name,
      team: m.user.jobTitle?.includes('Design')
        ? 'Product & Design'
        : m.user.jobTitle?.includes('Mobile')
        ? 'Mobile & AI'
        : 'Core Platform',
    }));
  }

  async inviteMember(params: { name: string; email: string; role?: string; team?: string; inviterName?: string }) {
    const { name, email, role = 'Developer', team = 'Core Platform', inviterName = 'Your team lead' } = params;

    if (!name || !email) {
      throw ApiError.badRequest('Name and email are required');
    }

    const temporaryPassword = 'Ivors@Optics2026';
    let isNewUser = false;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      isNewUser = true;
      const defaultPasswordHash = await bcrypt.hash(temporaryPassword, 10);
      user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: defaultPasswordHash,
          jobTitle: role,
        },
      });
    }

    let rbacRole = await prisma.role.findFirst({ where: { name: role } });
    if (!rbacRole) {
      rbacRole = await prisma.role.create({
        data: { name: role, isSystem: true },
      });
    }

    let orgName = 'Optics Workspace';
    const firstOrg = await prisma.organization.findFirst();
    if (firstOrg) {
      orgName = firstOrg.name;
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: firstOrg.id,
            userId: user.id,
          },
        },
        update: { roleId: rbacRole.id },
        create: {
          organizationId: firstOrg.id,
          userId: user.id,
          roleId: rbacRole.id,
        },
      });
    }

    // Dispatch welcome / invite email asynchronously using no-reply sender
    mailService
      .sendTeamInviteMail({
        to: email,
        name,
        inviterName,
        orgName,
        role: rbacRole.name,
        temporaryPassword: isNewUser ? temporaryPassword : undefined,
        loginUrl: config.cors.origin !== '*' ? config.cors.origin : 'http://localhost:3000',
      })
      .catch((err) => {
        console.error('[TeamService] Error dispatching team invite email:', err);
      });

    return {
      member: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          jobTitle: user.jobTitle,
        },
        role: rbacRole.name,
        team,
      },
    };
  }

  async updateMemberRole(userId: string, role: string) {
    let rbacRole = await prisma.role.findFirst({ where: { name: role } });
    if (!rbacRole) {
      rbacRole = await prisma.role.create({
        data: { name: role, isSystem: true },
      });
    }

    const firstOrg = await prisma.organization.findFirst();
    if (firstOrg) {
      await prisma.organizationMember.updateMany({
        where: { organizationId: firstOrg.id, userId },
        data: { roleId: rbacRole.id },
      });
    }

    return { success: true, message: 'Member role updated' };
  }

  async removeMember(userId: string) {
    const firstOrg = await prisma.organization.findFirst();
    if (firstOrg) {
      await prisma.organizationMember.deleteMany({
        where: { organizationId: firstOrg.id, userId },
      });
    }

    return { success: true, message: 'Member removed' };
  }
}

export const teamService = new TeamService();
