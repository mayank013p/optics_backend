import prisma from '../config/database';
import { ApiError } from '../utils/apiError';

export interface CreateProjectDTO {
  name: string;
  key: string;
  description?: string | null;
  organizationId?: string;
  workspaceId?: string;
  color?: string;
  icon?: string;
  userId: string;
}

export class ProjectService {
  async listProjects() {
    const projects = await prisma.project.findMany({
      include: {
        boards: {
          include: {
            columns: {
              orderBy: { position: 'asc' },
            },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true } },
            role: true,
          },
        },
        _count: {
          select: { issues: true, documents: true, members: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return projects;
  }

  async createProject(dto: CreateProjectDTO) {
    const { name, key, description, color, icon, userId } = dto;
    let { organizationId, workspaceId } = dto;

    const cleanKey = String(key).toUpperCase().trim();

    if (!organizationId || !workspaceId) {
      const firstOrg = await prisma.organization.findFirst({
        include: { workspaces: true },
      });
      if (firstOrg) {
        organizationId = firstOrg.id;
        workspaceId = firstOrg.workspaces[0]?.id;
      } else {
        throw ApiError.badRequest('No organizations found. Please create an organization first.');
      }
    }

    // Check key uniqueness in organization
    const existing = await prisma.project.findUnique({
      where: {
        organizationId_key: {
          organizationId: String(organizationId),
          key: cleanKey,
        },
      },
    });

    if (existing) {
      throw ApiError.badRequest(`Project key '${cleanKey}' is already used in this organization`);
    }

    let pmRole = await prisma.role.findFirst({ where: { name: 'Project Lead' } });
    if (!pmRole) {
      pmRole = await prisma.role.create({
        data: { name: 'Project Lead', isSystem: true },
      });
    }

    // Create project + default board + 5 workflow columns
    const project = await prisma.project.create({
      data: {
        name: String(name),
        key: cleanKey,
        description: description ? String(description) : null,
        organizationId: String(organizationId),
        workspaceId: String(workspaceId),
        leadId: userId,
        color: color ? String(color) : '#3B82F6',
        icon: icon ? String(icon) : 'folder',
        members: {
          create: {
            userId,
            roleId: pmRole.id,
          },
        },
        boards: {
          create: {
            name: `${name} Kanban Board`,
            isDefault: true,
            columns: {
              create: [
                { name: 'Backlog', position: 0, color: '#6B7280' },
                { name: 'Todo', position: 1, color: '#3B82F6' },
                { name: 'In Progress', position: 2, color: '#F59E0B' },
                { name: 'In Review', position: 3, color: '#8B5CF6' },
                { name: 'Done', position: 4, color: '#10B981' },
              ],
            },
          },
        },
        labels: {
          create: [
            { name: 'Bug', color: '#EF4444' },
            { name: 'Feature', color: '#3B82F6' },
            { name: 'Frontend', color: '#EC4899' },
            { name: 'Backend', color: '#10B981' },
            { name: 'High Priority', color: '#DC2626' },
          ],
        },
      },
      include: {
        boards: {
          include: { columns: true },
        },
        labels: true,
        _count: {
          select: { issues: true, documents: true, members: true },
        },
      },
    });

    // Record activity log
    await prisma.activityLog.create({
      data: {
        entityType: 'PROJECT',
        entityId: project.id,
        action: 'CREATED',
        userId,
        organizationId: String(organizationId),
        projectId: project.id,
        metadata: { projectName: project.name, projectKey: project.key },
      },
    });

    return project;
  }

  async getProjectDetails(projectId: string) {
    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { key: projectId.toUpperCase() }],
      },
      include: {
        boards: {
          include: {
            columns: {
              orderBy: { position: 'asc' },
              include: {
                issues: {
                  orderBy: { position: 'asc' },
                  include: {
                    assignees: { include: { user: true } },
                    labels: { include: { label: true } },
                    comments: { include: { user: true } },
                    _count: { select: { comments: true, attachments: true } },
                  },
                },
              },
            },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true } },
            role: true,
          },
        },
        labels: true,
        documents: {
          select: { id: true, title: true, icon: true, updatedAt: true, author: { select: { name: true } } },
        },
        _count: {
          select: { issues: true, documents: true, members: true },
        },
      },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    return project;
  }
}

export const projectService = new ProjectService();
