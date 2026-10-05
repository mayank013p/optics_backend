import prisma from '../config/database';
import { ApiError } from '../utils/apiError';

export class WorkspaceService {
  async createWorkspace(userId: string, name: string, organizationId: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);

    let ownerRole = await prisma.role.findFirst({ where: { name: 'Organization Owner' } });
    if (!ownerRole) {
      ownerRole = await prisma.role.create({
        data: { name: 'Organization Owner', isSystem: true },
      });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        organizationId: String(organizationId),
        members: {
          create: {
            userId,
            roleId: ownerRole.id,
          },
        },
      },
      include: {
        projects: true,
      },
    });

    return workspace;
  }

  async getWorkspaceDetails(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        projects: {
          include: {
            _count: { select: { issues: true, members: true } },
          },
        },
        teams: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw ApiError.notFound('Workspace not found');
    }

    return workspace;
  }
}

export const workspaceService = new WorkspaceService();
