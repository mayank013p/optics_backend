import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';
import { broadcastMemberRoleUpdate } from '../sockets/boardSocket';
import mailService from '../services/mail.service';

const router = Router();
router.use(authenticateJWT);

// List Organization Team Members
router.get('/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const targetOrgId = req.query.orgId as string | undefined;
    const where: any = targetOrgId
      ? { organizationId: targetOrgId, organization: { members: { some: { userId: req.user!.id } } } }
      : { organization: { members: { some: { userId: req.user!.id } } } };

    const orgMembers = await prisma.organizationMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
            workspaceMembers: {
              select: { workspaceId: true },
            },
            teamMembers: {
              include: { team: true },
            },
          },
        },
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const members = orgMembers.map((m) => {
      const dbTeam = m.user.teamMembers?.[0]?.team?.name;
      const assignedTeam = dbTeam || (m.user.jobTitle?.includes('Design') ? 'Product & Design' : m.user.jobTitle?.includes('Mobile') ? 'Mobile & AI' : 'Core Platform');
      const wsIds = m.user.workspaceMembers?.map((wm) => wm.workspaceId) || [];
      return {
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          jobTitle: m.user.jobTitle,
        },
        role: m.role.name,
        team: assignedTeam,
        workspaceId: wsIds[0],
        workspaceIds: wsIds,
      };
    });

    res.json({ members });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List Teams (scoped to user organization)
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });
    const allowedOrgIds = userOrgs.map((o) => o.organizationId);

    if (allowedOrgIds.length === 0) {
      res.json({ teams: [] });
      return;
    }

    let targetOrgId = req.query.orgId as string | undefined;
    if (!targetOrgId || !allowedOrgIds.includes(targetOrgId)) {
      targetOrgId = allowedOrgIds[0];
    }

    const teams = await prisma.team.findMany({
      where: { organizationId: targetOrgId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ teams });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List Invitations for Organization
router.get('/invitations', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userOrg = await prisma.organizationMember.findFirst({
      where: { userId: req.user!.id },
      include: { organization: true },
    });

    if (!userOrg) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: userOrg.organizationId,
      },
      include: {
        role: true,
        workspace: true,
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invitations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke / Cancel Invitation
router.delete('/invitations/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const inviteId = String(req.params.id);
    const userOrg = await prisma.organizationMember.findFirst({
      where: { userId: req.user!.id },
    });

    if (!userOrg) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const invite = await prisma.invitation.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.organizationId !== userOrg.organizationId) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    await prisma.invitation.update({
      where: { id: inviteId },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, message: 'Invitation revoked successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resend Invitation Email
router.post('/invitations/:id/resend', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const inviteId = String(req.params.id);
    const userOrg = await prisma.organizationMember.findFirst({
      where: { userId: req.user!.id },
      include: { organization: true },
    });

    if (!userOrg) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const invite = await prisma.invitation.findUnique({
      where: { id: inviteId },
      include: {
        role: true,
      },
    });

    if (!invite || invite.organizationId !== userOrg.organizationId) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // Refresh token and expiration
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatedInvite = await prisma.invitation.update({
      where: { id: inviteId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        status: 'PENDING',
      },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/invite?token=${newToken}`;

    mailService
      .sendInvitationEmail({
        to: invite.email,
        inviterName: req.user?.name || 'Your Team Lead',
        orgName: userOrg.organization.name,
        roleName: invite.role.name,
        teamName: invite.teamName || undefined,
        inviteUrl,
        expiresDays: 7,
      })
      .catch((err) => {
        console.error('[MailService Resend Invite Error]:', err.message);
      });

    res.json({
      success: true,
      message: 'Invitation resent successfully',
      inviteUrl,
      invitation: updatedInvite,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Invite / Add Member (Real Email Delivery + Invitation Record)
router.post('/invite', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, email, role = 'Developer', team = 'Core Platform', workspaceId } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find the current user's organization
    const callerMember = await prisma.organizationMember.findFirst({
      where: { userId: req.user!.id },
      include: { organization: { include: { workspaces: true } } },
    });

    const organization = callerMember?.organization || await prisma.organization.findFirst({
      include: { workspaces: true },
    });

    if (!organization) {
      res.status(404).json({ error: 'No active organization found' });
      return;
    }

    // 2. Check if target user is already a member of this organization
    const existingOrgMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { email: normalizedEmail },
      },
    });

    if (existingOrgMember) {
      res.status(400).json({ error: `User with email "${normalizedEmail}" is already a member of this organization` });
      return;
    }

    // 3. Resolve RBAC Role
    let rbacRole = await prisma.role.findFirst({ where: { name: role } });
    if (!rbacRole) {
      rbacRole = await prisma.role.create({
        data: { name: role, isSystem: true },
      });
    }

    // 4. Create or locate User record
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Create user placeholder with random temporary hash until they accept invitation and set their password
      const tempPass = crypto.randomBytes(16).toString('hex');
      const tempHash = await bcrypt.hash(tempPass, 10);
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name.trim(),
          passwordHash: tempHash,
          jobTitle: team,
          emailVerified: false,
        },
      });
    }

    const targetWsId = workspaceId || organization.workspaces[0]?.id;

    // 5. Link OrganizationMember
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: { roleId: rbacRole.id },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roleId: rbacRole.id,
      },
    });

    // 6. Link WorkspaceMember
    if (targetWsId) {
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: targetWsId,
            userId: user.id,
          },
        },
        update: { roleId: rbacRole.id },
        create: {
          workspaceId: targetWsId,
          userId: user.id,
          roleId: rbacRole.id,
        },
      });
    }

    // 7. Link Team & TeamMember
    if (team) {
      let dbTeam = await prisma.team.findFirst({
        where: { name: team, organizationId: organization.id },
      });
      if (!dbTeam) {
        dbTeam = await prisma.team.create({
          data: {
            name: team,
            organizationId: organization.id,
            workspaceId: targetWsId || null,
          },
        });
      }
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: dbTeam.id,
            userId: user.id,
          },
        },
        update: { roleId: rbacRole.id },
        create: {
          teamId: dbTeam.id,
          userId: user.id,
          roleId: rbacRole.id,
        },
      });
    }

    // 8. Generate Invitation Token & Record
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        token,
        roleId: rbacRole.id,
        organizationId: organization.id,
        workspaceId: targetWsId || null,
        teamName: team,
        invitedById: req.user!.id,
        status: 'PENDING',
        expiresAt,
      },
    });

    // 9. Dispatch email asynchronously in background
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/invite?token=${token}`;

    mailService
      .sendInvitationEmail({
        to: normalizedEmail,
        recipientName: name.trim(),
        inviterName: req.user?.name || 'Your Team Lead',
        orgName: organization.name,
        roleName: rbacRole.name,
        teamName: team,
        inviteUrl,
        expiresDays: 7,
      })
      .catch((err) => {
        console.error('[MailService Invite Dispatch Error]:', err.message);
      });

    res.status(201).json({
      member: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          jobTitle: user.jobTitle,
        },
        role: rbacRole.name,
        team,
        workspaceId: targetWsId,
        status: 'PENDING_INVITE',
      },
      invitation: {
        id: invitation.id,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      },
      inviteUrl,
      emailSent: true,
      message: `Invitation queued and link generated for ${normalizedEmail}`,
    });
  } catch (err: any) {
    console.error('Invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Member Role, Team, and/or Workspace
router.patch('/members/:userId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);
    const { role, team, workspaceId } = req.body;

    const firstOrg = await prisma.organization.findFirst({
      include: { workspaces: true },
    });

    if (!firstOrg) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Check if target user is Organization Owner
    const currentMember = await prisma.organizationMember.findFirst({
      where: { organizationId: firstOrg.id, userId },
      include: { role: true },
    });

    if (currentMember?.role?.name === 'Organization Owner' && role && role !== 'Organization Owner') {
      res.status(400).json({ error: 'Cannot demote or change the role of the Organization Owner' });
      return;
    }

    if (role) {
      let rbacRole = await prisma.role.findFirst({ where: { name: role } });
      if (!rbacRole) {
        rbacRole = await prisma.role.create({
          data: { name: role, isSystem: true },
        });
      }

      await prisma.organizationMember.updateMany({
        where: { organizationId: firstOrg.id, userId },
        data: { roleId: rbacRole.id },
      });

      await prisma.workspaceMember.updateMany({
        where: { userId },
        data: { roleId: rbacRole.id },
      });
    }

    if (team) {
      let dbTeam = await prisma.team.findFirst({
        where: { name: team, organizationId: firstOrg.id },
      });
      if (!dbTeam) {
        dbTeam = await prisma.team.create({
          data: {
            name: team,
            organizationId: firstOrg.id,
            workspaceId: workspaceId || firstOrg.workspaces[0]?.id || null,
          },
        });
      }

      const existingTeams = await prisma.team.findMany({
        where: { organizationId: firstOrg.id },
        select: { id: true },
      });
      await prisma.teamMember.deleteMany({
        where: {
          userId,
          teamId: { in: existingTeams.map((t) => t.id) },
        },
      });

      await prisma.teamMember.create({
        data: {
          teamId: dbTeam.id,
          userId,
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { jobTitle: team },
      });
    }

    if (workspaceId) {
      const targetRole = await prisma.role.findFirst({ where: { name: role || 'Developer' } });
      if (targetRole) {
        await prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId,
            },
          },
          update: { roleId: targetRole.id },
          create: {
            workspaceId,
            userId,
            roleId: targetRole.id,
          },
        });
      }
    }

    // Real-time broadcast to all connected clients
    broadcastMemberRoleUpdate({
      userId,
      role: role || currentMember?.role?.name || 'Developer',
      team,
    });

    res.json({ success: true, message: 'Member updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove Member
router.delete('/members/:userId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);

    if (userId === req.user!.id) {
      res.status(400).json({ error: 'Cannot remove yourself from the organization' });
      return;
    }

    const firstOrg = await prisma.organization.findFirst();

    if (firstOrg) {
      const currentMember = await prisma.organizationMember.findFirst({
        where: { organizationId: firstOrg.id, userId },
        include: { role: true },
      });

      if (currentMember?.role?.name === 'Organization Owner') {
        res.status(400).json({ error: 'Cannot remove the Organization Owner' });
        return;
      }
      await prisma.organizationMember.deleteMany({
        where: { organizationId: firstOrg.id, userId },
      });
      await prisma.workspaceMember.deleteMany({
        where: { userId },
      });
      await prisma.teamMember.deleteMany({
        where: { userId },
      });
    }

    res.json({ success: true, message: 'Member removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
