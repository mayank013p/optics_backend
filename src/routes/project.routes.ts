import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// List all Projects (optionally filter by workspaceId)
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.query;

    const where: any = {
      workspace: {
        members: { some: { userId: req.user!.id } },
      },
    };
    if (workspaceId) {
      where.workspaceId = String(workspaceId);
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
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

    res.json({ projects });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Project with default Kanban Board & standard Columns
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, key, description, organizationId, workspaceId, color, icon } = req.body;

    if (!name || !key) {
      res.status(400).json({ error: 'Missing required fields: name, key' });
      return;
    }

    const cleanKey = String(key).toUpperCase().trim();

    // Find default org and workspace if not supplied
    let orgId = organizationId;
    let wsId = workspaceId;

    if (!orgId) {
      const firstOrg = await prisma.organization.findFirst({
        include: { workspaces: true },
      });
      if (firstOrg) {
        orgId = firstOrg.id;
        wsId = firstOrg.workspaces[0]?.id;
      }
    }

    // Create project + default board + 5 workflow columns
    let pmRole = await prisma.role.findFirst({ where: { name: 'Project Lead' } });
    if (!pmRole) {
      pmRole = await prisma.role.create({
        data: { name: 'Project Lead', isSystem: true },
      });
    }

    const project = await prisma.project.create({
      data: {
        name: String(name),
        key: cleanKey,
        description: description ? String(description) : null,
        organizationId: orgId,
        workspaceId: wsId,
        leadId: req.user!.id,
        color: color ? String(color) : '#3B82F6',
        icon: icon ? String(icon) : 'folder',
        members: {
          create: {
            userId: req.user!.id,
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
    if (orgId) {
      await prisma.activityLog.create({
        data: {
          entityType: 'PROJECT',
          entityId: project.id,
          action: 'CREATED',
          userId: req.user!.id,
          organizationId: orgId,
          projectId: project.id,
          metadata: { projectName: project.name, projectKey: project.key },
        },
      });
    }

    res.status(201).json({ project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Project Details by ID or Key
router.get('/:projectId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);

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
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Project
router.patch('/:projectId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);
    const { name, description, color, status, workspaceId } = req.body;

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: name ? String(name) : undefined,
        description: description !== undefined ? (description ? String(description) : null) : undefined,
        color: color ? String(color) : undefined,
        status: status ? String(status) : undefined,
        workspaceId: workspaceId ? String(workspaceId) : undefined,
      },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    res.json({ project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Project
router.delete('/:projectId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);

    // Permission check: only Owner or Admin can delete projects
    const orgMember = await prisma.organizationMember.findFirst({
      where: { userId: req.user!.id },
      include: { role: true },
    });
    const isAdmin = 
      orgMember?.role?.name === 'Organization Owner' || 
      orgMember?.role?.name === 'Workspace Admin';
    if (!isAdmin) {
      res.status(403).json({ error: 'Permission denied: Only administrators can delete projects' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Check total projects in workspace
    const wsProjectsCount = await prisma.project.count({
      where: { workspaceId: project.workspaceId },
    });
    if (wsProjectsCount <= 1) {
      res.status(400).json({ error: 'Cannot delete the only project in this workspace' });
      return;
    }

    await prisma.project.delete({
      where: { id: projectId },
    });
    res.json({ success: true, message: 'Project deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
