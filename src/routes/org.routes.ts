import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';
import { broadcastPermissionsUpdate } from '../sockets/boardSocket';

const router = Router();
router.use(authenticateJWT);

// List user's organizations
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.user!.id },
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

    res.json({
      organizations: memberships.map((m) => ({
        ...m.organization,
        currentUserRole: m.role.name,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create organization
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Organization name is required' });
      return;
    }

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
            userId: req.user!.id,
            roleId: ownerRole.id,
          },
        },
        workspaces: {
          create: {
            name: 'General',
            slug: 'general',
            members: {
              create: {
                userId: req.user!.id,
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

    res.status(201).json({ organization: org });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all Roles & Permissions Matrix
router.get('/roles', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Alias to /roles/matrix
  return listRolesMatrix(req, res);
});

router.get('/roles/matrix', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  return listRolesMatrix(req, res);
});

async function listRolesMatrix(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const standardPerms = [
      { code: 'org.manage', name: 'Manage Organization Settings & Security', category: 'Organization' },
      { code: 'user.invite', name: 'Invite Team Members', category: 'Organization' },
      { code: 'user.assign_role', name: 'Manage Member Roles & Access', category: 'Organization' },
      { code: 'user.delete', name: 'Remove Members from Workspace', category: 'Organization' },
      { code: 'workspace.create', name: 'Create Workspaces', category: 'Workspace' },
      { code: 'workspace.manage', name: 'Manage Workspace Settings', category: 'Workspace' },
      { code: 'project.create', name: 'Create Projects', category: 'Project' },
      { code: 'project.update', name: 'Update Project Details', category: 'Project' },
      { code: 'project.delete', name: 'Delete Projects', category: 'Project' },
      { code: 'board.configure', name: 'Configure Kanban Columns & WIP Limits', category: 'Board' },
      { code: 'task.create', name: 'Create & Assign Tasks', category: 'Task' },
      { code: 'task.update', name: 'Edit & Update Tasks', category: 'Task' },
      { code: 'task.move', name: 'Move & Transition Tasks', category: 'Task' },
      { code: 'task.delete', name: 'Delete Tasks', category: 'Task' },
      { code: 'comment.create', name: 'Post Comments & Activity Mentions', category: 'Task' },
      { code: 'doc.create', name: 'Create & Edit Project Wiki Docs', category: 'Document' },
      { code: 'doc.delete', name: 'Delete Project Wiki Docs', category: 'Document' },
      { code: 'attachment.upload', name: 'Upload Cloud Attachments', category: 'Storage' },
      { code: 'attachment.delete', name: 'Delete Cloud Attachments', category: 'Storage' },
    ];

    for (const sp of standardPerms) {
      await prisma.permission.upsert({
        where: { code: sp.code },
        update: { name: sp.name, category: sp.category },
        create: sp,
      });
    }

    const standardRoles = [
      { name: 'Organization Owner', description: 'Full organization superuser access' },
      { name: 'Workspace Admin', description: 'Full workspace and project configuration access' },
      { name: 'Project Lead', description: 'Can manage projects, configure boards, and coordinate tasks' },
      { name: 'Developer', description: 'Can create and transition tasks, docs, and attachments' },
      { name: 'Viewer', description: 'Read-only view access across projects and boards' },
    ];

    for (const sr of standardRoles) {
      const existing = await prisma.role.findFirst({ where: { name: sr.name } });
      if (!existing) {
        await prisma.role.create({
          data: {
            name: sr.name,
            description: sr.description,
            isSystem: true,
          },
        });
      }
    }

    const allDbPerms = await prisma.permission.findMany();
    const permMap = new Map(allDbPerms.map((p) => [p.code, p.id]));

    const defaultRolePerms: Record<string, string[]> = {
      'Organization Owner': ['*'],
      'Workspace Admin': [
        'org.manage',
        'user.invite',
        'user.assign_role',
        'user.delete',
        'workspace.create',
        'workspace.manage',
        'project.create',
        'project.update',
        'project.delete',
        'board.configure',
        'task.create',
        'task.update',
        'task.move',
        'task.delete',
        'comment.create',
        'doc.create',
        'doc.delete',
        'attachment.upload',
        'attachment.delete',
      ],
      'Project Lead': [
        'user.invite',
        'project.create',
        'project.update',
        'board.configure',
        'task.create',
        'task.update',
        'task.move',
        'task.delete',
        'comment.create',
        'doc.create',
        'doc.delete',
        'attachment.upload',
      ],
      'Developer': [
        'task.create',
        'task.update',
        'task.move',
        'comment.create',
        'doc.create',
        'attachment.upload',
      ],
      'Viewer': [],
    };

    const existingRoles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
    });

    // Auto-seed default role permissions ONLY on initial cold start if total role permissions in DB is 0
    const totalRolePerms = await prisma.rolePermission.count();
    if (totalRolePerms === 0) {
      for (const r of existingRoles) {
        if (defaultRolePerms[r.name]) {
          const codesToAssign = defaultRolePerms[r.name];
          for (const code of codesToAssign) {
            const permId = permMap.get(code);
            if (permId) {
              await prisma.rolePermission.upsert({
                where: {
                  roleId_permissionId: { roleId: r.id, permissionId: permId },
                },
                update: {},
                create: { roleId: r.id, permissionId: permId },
              });
            }
          }
        }
      }
    }

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: { select: { organizationMembers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const permissions = await prisma.permission.findMany({
      where: {
        code: {
          in: standardPerms.map((p) => p.code),
        },
      },
      orderBy: { category: 'asc' },
    });

    res.json({ roles, permissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Update Role Permissions (Toggle single capability or batch update)
router.patch('/roles/:roleId/permissions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const roleId = String(req.params.roleId);
    const { permissionCode, enabled, permissionCodes } = req.body;

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    if (role.name === 'Organization Owner') {
      res.status(400).json({ error: 'Organization Owner has immutable superuser permissions' });
      return;
    }

    const ALIAS_MAP: Record<string, string[]> = {
      'task.create': ['issue.create', 'issues.create'],
      'issue.create': ['task.create'],
      'task.update': ['issue.update', 'issues.update'],
      'issue.update': ['task.update'],
      'task.delete': ['issue.delete', 'issues.delete'],
      'issue.delete': ['task.delete'],
      'task.move': ['issue.move', 'issues.move'],
      'issue.move': ['task.move'],
      'doc.create': ['document.create', 'docs.create'],
      'document.create': ['doc.create'],
      'doc.delete': ['document.delete', 'docs.delete'],
      'document.delete': ['doc.delete'],
    };

    if (Array.isArray(permissionCodes)) {
      // Full authoritative sync
      const targetCodes = Array.from(
        new Set(
          permissionCodes.map((c) =>
            c.startsWith('issue.')
              ? c.replace('issue.', 'task.')
              : c.startsWith('document.')
              ? c.replace('document.', 'doc.')
              : c
          )
        )
      );

      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

      for (const code of targetCodes) {
        let perm = await prisma.permission.findUnique({ where: { code } });
        if (!perm) {
          perm = await prisma.permission.create({
            data: {
              code,
              name: code,
              category: code.split('.')[0] || 'custom',
            },
          });
        }
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    } else if (permissionCode !== undefined) {
      const allRelatedCodes = [permissionCode, ...(ALIAS_MAP[permissionCode] || [])];
      
      if (enabled) {
        let perm = await prisma.permission.findUnique({ where: { code: permissionCode } });
        if (!perm) {
          perm = await prisma.permission.create({
            data: {
              code: permissionCode,
              name: permissionCode,
              category: permissionCode.split('.')[0] || 'custom',
            },
          });
        }

        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      } else {
        // Find all matching permission rows for this code and its aliases
        const matchingDbPerms = await prisma.permission.findMany({
          where: { code: { in: allRelatedCodes } },
        });
        if (matchingDbPerms.length > 0) {
          await prisma.rolePermission.deleteMany({
            where: {
              roleId: role.id,
              permissionId: { in: matchingDbPerms.map((p) => p.id) },
            },
          });
        }
      }
    }

    const updated = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    const rawPermCodes = updated?.permissions.map((p) => p.permission.code) || [];
    const permCodes = Array.from(
      new Set(
        rawPermCodes.map((c) =>
          c.startsWith('issue.')
            ? c.replace('issue.', 'task.')
            : c.startsWith('document.')
            ? c.replace('document.', 'doc.')
            : c
        )
      )
    );

    // Real-time broadcast to all connected clients
    broadcastPermissionsUpdate({
      roleId,
      roleName: updated?.name,
      permissionCode,
      enabled,
      permissionCodes: permCodes,
    });

    res.json({
      success: true,
      role: updated,
      permissionCodes: permCodes,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Custom Role
router.post('/roles', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description, permissionCodes } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Role name is required' });
      return;
    }

    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        isSystem: false,
      },
    });

    if (Array.isArray(permissionCodes) && permissionCodes.length > 0) {
      for (const code of permissionCodes) {
        let perm = await prisma.permission.findUnique({ where: { code } });
        if (!perm) {
          perm = await prisma.permission.create({
            data: { code, name: code, category: code.split('.')[0] || 'custom' },
          });
        }
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }

    res.status(201).json({ role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Custom Role
router.delete('/roles/:roleId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const roleId = String(req.params.roleId);
    const role = await prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    const defaultNames = [
      'Organization Owner',
      'Workspace Admin',
      'Project Lead',
      'Developer',
      'Product Designer',
      'Viewer'
    ];

    if (role.isSystem || defaultNames.some((n) => n.toLowerCase() === role.name.toLowerCase())) {
      res.status(400).json({ error: `Cannot delete default system role "${role.name}"` });
      return;
    }

    // Check if role is currently assigned to any members
    const memberCount = await prisma.organizationMember.count({ where: { roleId } });
    if (memberCount > 0) {
      res.status(400).json({
        error: `Cannot delete role "${role.name}" because it is currently assigned to ${memberCount} member(s). Reassign them first.`
      });
      return;
    }

    // Cascade delete role permissions then role
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.role.delete({ where: { id: roleId } });
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get organization details with workspaces, members, projects
router.get('/:orgId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = String(req.params.orgId);
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
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ organization: org });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Leave an Organization
router.post('/:orgId/leave', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = String(req.params.orgId);
    const userId = req.user!.id;

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      include: { role: true },
    });

    if (!membership) {
      res.status(404).json({ error: 'You are not a member of this organization.' });
      return;
    }

    // If caller is an Owner, check if they are the sole owner with remaining members
    if (membership.role.name === 'Organization Owner') {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId: orgId,
          role: { name: 'Organization Owner' },
        },
      });

      const totalMembers = await prisma.organizationMember.count({
        where: { organizationId: orgId },
      });

      if (ownerCount <= 1 && totalMembers > 1) {
        res.status(400).json({
          error: 'As the sole Organization Owner, please transfer ownership to another member before leaving, or delete the organization.'
        });
        return;
      }
    }

    // Clean up team memberships in this org
    const orgTeams = await prisma.team.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    if (orgTeams.length > 0) {
      await prisma.teamMember.deleteMany({
        where: {
          teamId: { in: orgTeams.map(t => t.id) },
          userId,
        },
      });
    }

    // Clean up workspace memberships in this org
    const orgWorkspaces = await prisma.workspace.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    if (orgWorkspaces.length > 0) {
      await prisma.workspaceMember.deleteMany({
        where: {
          workspaceId: { in: orgWorkspaces.map(w => w.id) },
          userId,
        },
      });
    }

    // Remove organization membership
    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    res.json({ success: true, message: 'You have left the organization.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an Organization (Owners Only)
router.delete('/:orgId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = String(req.params.orgId);
    const userId = req.user!.id;

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      include: { role: true },
    });

    if (!membership || membership.role.name !== 'Organization Owner') {
      res.status(403).json({ error: 'Only an Organization Owner can delete the organization.' });
      return;
    }

    // Delete organization (Prisma cascades related workspaces, projects, issues, docs, etc.)
    await prisma.organization.delete({
      where: { id: orgId },
    });

    res.json({ success: true, message: 'Organization deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
