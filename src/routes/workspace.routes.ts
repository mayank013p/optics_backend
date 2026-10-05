import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// List all Workspaces in the active organization with nested projects
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userOrgMembers = await prisma.organizationMember.findMany({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });
    const allowedOrgIds = userOrgMembers.map((m) => m.organizationId);

    // If user belongs to no organizations, return empty array immediately (never leak other workspaces!)
    if (allowedOrgIds.length === 0) {
      res.json({ workspaces: [] });
      return;
    }

    let targetOrgId = req.query.orgId as string | undefined;
    if (!targetOrgId || !allowedOrgIds.includes(targetOrgId)) {
      targetOrgId = allowedOrgIds[0];
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        organizationId: targetOrgId,
        members: { some: { userId: req.user!.id } },
      },
      include: {
        projects: {
          include: {
            _count: { select: { issues: true, members: true, documents: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true } },
            role: true,
          },
        },
        _count: {
          select: { projects: true, members: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ workspaces });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create workspace inside org
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, organizationId, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Workspace name is required' });
      return;
    }

    let targetOrgId = organizationId;
    if (!targetOrgId) {
      const firstOrg = await prisma.organization.findFirst({
        where: { members: { some: { userId: req.user!.id } } },
      });
      if (firstOrg) {
        targetOrgId = firstOrg.id;
      }
    }

    if (!targetOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

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
        organizationId: targetOrgId,
        members: {
          create: {
            userId: req.user!.id,
            roleId: ownerRole.id,
          },
        },
      },
      include: {
        projects: {
          include: {
            _count: { select: { issues: true, members: true, documents: true } },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            role: true,
          },
        },
      },
    });

    res.status(201).json({ workspace });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get workspace details & projects
router.get('/:workspaceId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = String(req.params.workspaceId);

    const isMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user!.id },
    });
    if (!isMember) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        projects: {
          include: {
            _count: { select: { issues: true, members: true, documents: true } },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            role: true,
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
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    res.json({ workspace });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update workspace
router.patch('/:workspaceId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = String(req.params.workspaceId);
    const { name } = req.body;

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: name ? String(name) : undefined,
      },
      include: {
        projects: true,
      },
    });

    res.json({ workspace });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete workspace
router.delete('/:workspaceId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = String(req.params.workspaceId);

    const totalWorkspaces = await prisma.workspace.count();
    if (totalWorkspaces <= 1) {
      res.status(400).json({ error: 'Cannot delete the only remaining workspace in the organization' });
      return;
    }

    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    if (ws.slug === 'primary') {
      res.status(400).json({ error: 'Cannot delete the primary root workspace' });
      return;
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
    res.json({ success: true, message: 'Workspace deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
