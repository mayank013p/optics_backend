import prisma from '../config/database';
import { ApiError } from '../utils/apiError';

export class OrgService {
  async listUserOrganizations(userId: string) {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            workspaces: true,
            _count: {
              select: { members: true, projects: true },
            },
          },
        },
        role: true,
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      currentUserRole: m.role.name,
    }));
  }

  async createOrganization(userId: string, name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

    let ownerRole = await prisma.role.findFirst({ where: { name: 'Organization Owner' } });
    if (!ownerRole) {
      ownerRole = await prisma.role.create({
        data: {
          name: 'Organization Owner',
          description: 'Full access to organization resources',
          isSystem: true,
        },
      });
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId,
            roleId: ownerRole.id,
          },
        },
        workspaces: {
          create: {
            name: 'General',
            slug: 'general',
            members: {
              create: {
                userId,
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

    return org;
  }

  async getOrganizationDetails(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: {
          include: {
            projects: {
              include: {
                _count: {
                  select: { issues: true, members: true },
                },
              },
            },
          },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            role: true,
          },
        },
        teams: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!org) {
      throw ApiError.notFound('Organization not found');
    }

    return org;
  }
}

export const orgService = new OrgService();
