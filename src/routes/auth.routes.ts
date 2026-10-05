import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';
import mailService from '../services/mail.service';
import { OtpPurpose } from '@prisma/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'optics_super_secure_jwt_secret_key_2026_ivors';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  code: z.string().min(6).max(6),
  orgName: z.string().optional().nullable(),
  inviteToken: z.string().optional().nullable(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Verify Invitation Token (Public)
router.get('/invite/:token', async (req, res): Promise<void> => {
  try {
    const token = String(req.params.token).trim();

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
        workspace: true,
        role: true,
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found or invalid' });
      return;
    }

    if (invitation.status === 'ACCEPTED') {
      res.status(400).json({
        error: 'This invitation has already been accepted. Please sign in with your email.',
        alreadyAccepted: true,
      });
      return;
    }

    if (invitation.status === 'CANCELLED') {
      res.status(400).json({
        error: 'This invitation has been revoked by the organization administrator.',
        cancelled: true,
      });
      return;
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      res.status(410).json({
        error: 'This invitation link has expired. Please ask your administrator to send a new invite.',
        expired: true,
      });
      return;
    }

    res.json({
      valid: true,
      invitation: {
        token: invitation.token,
        email: invitation.email,
        organizationName: invitation.organization.name,
        organizationSlug: invitation.organization.slug,
        roleName: invitation.role.name,
        teamName: invitation.teamName,
        workspaceName: invitation.workspace?.name || 'Primary Workspace',
        invitedByName: invitation.invitedBy?.name || 'Your Team Lead',
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err: any) {
    console.error('Verify invite error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify invitation' });
  }
});

// Accept Invitation (Public)
router.post('/invite/accept', async (req, res): Promise<void> => {
  try {
    const { token, name, password } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Invitation token is required' });
      return;
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token: String(token).trim() },
      include: {
        organization: { include: { workspaces: true } },
        workspace: true,
        role: true,
      },
    });

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found or invalid' });
      return;
    }

    if (invitation.status === 'ACCEPTED') {
      res.status(400).json({ error: 'Invitation already accepted. Please sign in.' });
      return;
    }

    if (invitation.status === 'CANCELLED') {
      res.status(400).json({ error: 'Invitation has been revoked.' });
      return;
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      res.status(410).json({ error: 'Invitation link has expired.' });
      return;
    }

    const email = invitation.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (!password || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          email,
          name: name ? name.trim() : email.split('@')[0],
          passwordHash,
          jobTitle: invitation.teamName || undefined,
          emailVerified: true,
        },
      });
    } else {
      // If user already existed, update password if provided
      const updateData: any = { emailVerified: true };
      if (password && password.length >= 6) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }
      if (name && name.trim()) {
        updateData.name = name.trim();
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    // Link OrganizationMember
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: user.id,
        },
      },
      update: { roleId: invitation.roleId },
      create: {
        organizationId: invitation.organizationId,
        userId: user.id,
        roleId: invitation.roleId,
      },
    });

    // Link WorkspaceMember
    const targetWsId = invitation.workspaceId || invitation.organization.workspaces[0]?.id;
    if (targetWsId) {
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: targetWsId,
            userId: user.id,
          },
        },
        update: { roleId: invitation.roleId },
        create: {
          workspaceId: targetWsId,
          userId: user.id,
          roleId: invitation.roleId,
        },
      });
    }

    // Link TeamMember if teamName is assigned
    if (invitation.teamName) {
      let team = await prisma.team.findFirst({
        where: { name: invitation.teamName, organizationId: invitation.organizationId },
      });
      if (!team) {
        team = await prisma.team.create({
          data: {
            name: invitation.teamName,
            organizationId: invitation.organizationId,
            workspaceId: targetWsId || null,
          },
        });
      }
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId: user.id,
          },
        },
        update: { roleId: invitation.roleId },
        create: {
          teamId: team.id,
          userId: user.id,
          roleId: invitation.roleId,
        },
      });
    }

    // Mark invitation as ACCEPTED
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name },
      organization: invitation.organization,
      workspace: invitation.workspace || invitation.organization.workspaces[0],
      role: invitation.role.name,
      message: `Successfully joined ${invitation.organization.name}`,
    });
  } catch (err: any) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: err.message || 'Failed to accept invitation' });
  }
});

// Register (Requires Email OTP verification; Joins via Invitation OR Creates Isolated Organization)
router.post('/register', async (req, res): Promise<void> => {
  try {
    const { email, password, name, code, orgName, inviteToken } = RegisterSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verify user doesn't already exist and verified
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser && existingUser.emailVerified) {
      res.status(400).json({ error: 'User already exists with this email. Please sign in instead.' });
      return;
    }

    // 2. Validate 6-digit OTP code for REGISTER
    const otp = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        purpose: OtpPurpose.REGISTER,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
      return;
    }

    if (otp.attempts >= 5) {
      res.status(400).json({ error: 'Too many failed verification attempts. Please request a new code.' });
      return;
    }

    if (otp.code !== String(code).trim()) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
      return;
    }

    // Mark OTP as used
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    const passwordHash = await bcrypt.hash(password, 10);
    let user: any;

    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: name.trim(),
          passwordHash,
          emailVerified: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name.trim(),
          emailVerified: true,
        },
      });
    }

    // 3. Check for Pending Invitation
    const pendingInvite = inviteToken
      ? await prisma.invitation.findUnique({
          where: { token: inviteToken.trim() },
          include: { organization: { include: { workspaces: true } }, role: true, workspace: true },
        })
      : await prisma.invitation.findFirst({
          where: { email: normalizedEmail, status: 'PENDING' },
          include: { organization: { include: { workspaces: true } }, role: true, workspace: true },
          orderBy: { createdAt: 'desc' },
        });

    if (pendingInvite && pendingInvite.status === 'PENDING' && new Date() <= new Date(pendingInvite.expiresAt)) {
      // Auto-join invited organization
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: pendingInvite.organizationId,
            userId: user.id,
          },
        },
        update: { roleId: pendingInvite.roleId },
        create: {
          organizationId: pendingInvite.organizationId,
          userId: user.id,
          roleId: pendingInvite.roleId,
        },
      });

      const targetWsId = pendingInvite.workspaceId || pendingInvite.organization.workspaces[0]?.id;
      if (targetWsId) {
        await prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: targetWsId,
              userId: user.id,
            },
          },
          update: { roleId: pendingInvite.roleId },
          create: {
            workspaceId: targetWsId,
            userId: user.id,
            roleId: pendingInvite.roleId,
          },
        });
      }

      if (pendingInvite.teamName) {
        let team = await prisma.team.findFirst({
          where: { name: pendingInvite.teamName, organizationId: pendingInvite.organizationId },
        });
        if (!team) {
          team = await prisma.team.create({
            data: {
              name: pendingInvite.teamName,
              organizationId: pendingInvite.organizationId,
              workspaceId: targetWsId || null,
            },
          });
        }
        await prisma.teamMember.upsert({
          where: {
            teamId_userId: {
              teamId: team.id,
              userId: user.id,
            },
          },
          update: { roleId: pendingInvite.roleId },
          create: {
            teamId: team.id,
            userId: user.id,
            roleId: pendingInvite.roleId,
          },
        });
      }

      await prisma.invitation.update({
        where: { id: pendingInvite.id },
        data: { status: 'ACCEPTED' },
      });

      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
        organization: pendingInvite.organization,
        workspace: pendingInvite.workspace || pendingInvite.organization.workspaces[0],
        joinedViaInvite: true,
        message: `Welcome to ${pendingInvite.organization.name}! You've joined as a ${pendingInvite.role.name}.`,
      });
      return;
    }

    // 4. If no pending invitation and no explicit orgName:
    // Registration completes cleanly without forcing a default workspace.
    // The user will be prompted to create their first workspace or join one in onboarding.
    if (!orgName || !orgName.trim()) {
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
        organization: null,
        workspace: null,
        hasOrganization: false,
        message: 'Account verified successfully. You can now create your first workspace or join an existing team.',
      });
      return;
    }

    // If explicit orgName was provided, create an isolated organization & primary workspace
    const cleanOrgName = orgName.trim();
    const orgSlug = cleanOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

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
        name: cleanOrgName,
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

    const primaryWs = org.workspaces[0];

    // Create default project for the new workspace
    if (primaryWs) {
      await prisma.project.create({
        data: {
          name: 'Sprint Board',
          key: 'SPRINT',
          description: 'Default project for sprint backlog and tasks',
          organizationId: org.id,
          workspaceId: primaryWs.id,
          boards: {
            create: {
              name: 'Sprint Kanban',
              columns: {
                create: [
                  { name: 'Backlog', position: 0, color: '#71717a' },
                  { name: 'To Do', position: 1, color: '#38bdf8' },
                  { name: 'In Progress', position: 2, color: '#f59e0b' },
                  { name: 'Done', position: 3, color: '#10b981' },
                ],
              },
            },
          },
        },
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: org,
      workspace: primaryWs,
      hasOrganization: true,
      message: `Organization '${cleanOrgName}' created successfully.`,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// Create Organization & Workspace for logged-in user
router.post('/create-org', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, workspaceName } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Organization or workspace name is required' });
      return;
    }

    const orgName = name.trim();
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
    const wsName = workspaceName && workspaceName.trim() ? workspaceName.trim() : 'Primary Workspace';
    const wsSlug = wsName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'primary';

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
        name: orgName,
        slug: orgSlug,
        members: {
          create: {
            userId: req.user!.id,
            roleId: ownerRole.id,
          },
        },
        workspaces: {
          create: {
            name: wsName,
            slug: wsSlug,
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

    const primaryWs = org.workspaces[0];
    if (primaryWs) {
      await prisma.project.create({
        data: {
          name: 'Sprint Board',
          key: 'SPRINT',
          description: 'Default project for sprint backlog and tasks',
          organizationId: org.id,
          workspaceId: primaryWs.id,
          boards: {
            create: {
              name: 'Sprint Kanban',
              columns: {
                create: [
                  { name: 'Backlog', position: 0, color: '#71717a' },
                  { name: 'To Do', position: 1, color: '#38bdf8' },
                  { name: 'In Progress', position: 2, color: '#f59e0b' },
                  { name: 'Done', position: 3, color: '#10b981' },
                ],
              },
            },
          },
        },
      });
    }

    res.status(201).json({
      organization: org,
      workspace: primaryWs,
      message: `Organization "${orgName}" created successfully`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List pending invitations for the logged-in user
router.get('/my-invites', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user!.email.toLowerCase();
    const invitations = await prisma.invitation.findMany({
      where: {
        email: userEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: true,
        workspace: true,
        role: true,
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        token: inv.token,
        organizationName: inv.organization.name,
        workspaceName: inv.workspace?.name || 'Primary Workspace',
        roleName: inv.role.name,
        teamName: inv.teamName,
        invitedByName: inv.invitedBy?.name || 'Team Lead',
        expiresAt: inv.expiresAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch pending invitations' });
  }
});

// Join Organization via Invite Code/Token for logged-in user
router.post('/join-invite', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Invitation token is required' });
      return;
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token: String(token).trim() },
      include: {
        organization: { include: { workspaces: true } },
        workspace: true,
        role: true,
      },
    });

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found or invalid' });
      return;
    }

    if (invitation.status === 'ACCEPTED') {
      res.status(400).json({ error: 'This invitation has already been accepted.' });
      return;
    }

    if (invitation.status === 'CANCELLED') {
      res.status(400).json({ error: 'This invitation has been revoked.' });
      return;
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      res.status(410).json({ error: 'Invitation link has expired.' });
      return;
    }

    const userId = req.user!.id;

    // Link OrganizationMember
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId,
        },
      },
      update: { roleId: invitation.roleId },
      create: {
        organizationId: invitation.organizationId,
        userId,
        roleId: invitation.roleId,
      },
    });

    const targetWsId = invitation.workspaceId || invitation.organization.workspaces[0]?.id;
    if (targetWsId) {
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: targetWsId,
            userId,
          },
        },
        update: { roleId: invitation.roleId },
        create: {
          workspaceId: targetWsId,
          userId,
          roleId: invitation.roleId,
        },
      });
    }

    if (invitation.teamName) {
      let team = await prisma.team.findFirst({
        where: { name: invitation.teamName, organizationId: invitation.organizationId },
      });
      if (!team) {
        team = await prisma.team.create({
          data: {
            name: invitation.teamName,
            organizationId: invitation.organizationId,
            workspaceId: targetWsId || null,
          },
        });
      }
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId,
          },
        },
        update: { roleId: invitation.roleId },
        create: {
          teamId: team.id,
          userId,
          roleId: invitation.roleId,
        },
      });
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });

    res.json({
      organization: invitation.organization,
      workspace: invitation.workspace || invitation.organization.workspaces[0],
      role: invitation.role.name,
      message: `Successfully joined ${invitation.organization.name}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
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
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organizations: user.organizationMembers.map((m) => ({
        ...m.organization,
        role: m.role.name,
      })),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Login failed' });
  }
});

// Get current user profile & orgs
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        jobTitle: true,
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
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile (name, jobTitle, avatarUrl)
router.patch('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, jobTitle, avatarUrl } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: name ? String(name) : undefined,
        jobTitle: jobTitle !== undefined ? (jobTitle ? String(jobTitle) : null) : undefined,
        avatarUrl: avatarUrl !== undefined ? (avatarUrl ? String(avatarUrl) : null) : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        jobTitle: true,
      },
    });

    res.json({ user: updatedUser, message: 'Profile updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Password
router.post('/password', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// OTP Authentication & Email Verification Endpoints
// ----------------------------------------------------

// 1. Send OTP (PASSWORD_RESET, LOGIN, or REGISTER)
router.post('/otp/send', async (req, res): Promise<void> => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) {
      res.status(400).json({ error: 'Email and purpose are required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const validPurposes: OtpPurpose[] = [OtpPurpose.PASSWORD_RESET, OtpPurpose.LOGIN, OtpPurpose.REGISTER];
    if (!validPurposes.includes(purpose as OtpPurpose)) {
      res.status(400).json({ error: 'Invalid OTP purpose. Must be PASSWORD_RESET, LOGIN, or REGISTER.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if ((purpose === OtpPurpose.PASSWORD_RESET || purpose === OtpPurpose.LOGIN) && !user) {
      res.status(404).json({ error: 'No account found with this email address' });
      return;
    }
    if (purpose === OtpPurpose.REGISTER && user && user.emailVerified) {
      res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    // Generate secure 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate existing unused OTPs
    await prisma.emailOtp.updateMany({
      where: { email: normalizedEmail, purpose: purpose as OtpPurpose, used: false },
      data: { used: true },
    });

    // Save new OTP
    await prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        code,
        purpose: purpose as OtpPurpose,
        expiresAt,
      },
    });

    // Send real email via AWS SES SMTP
    const mailResult = await mailService.sendOtpEmail({
      to: normalizedEmail,
      code,
      purpose: purpose as any,
      recipientName: user?.name,
      minutesExpires: 10,
    });

    res.json({
      success: true,
      emailSent: mailResult.success,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}`,
      expiresInMinutes: 10,
    });
  } catch (err: any) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification code' });
  }
});

// 2. Verify OTP code
router.post('/otp/verify', async (req, res): Promise<void> => {
  try {
    const { email, code, purpose } = req.body;
    if (!email || !code || !purpose) {
      res.status(400).json({ error: 'Email, code, and purpose are required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otp = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        purpose: purpose as OtpPurpose,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      res.status(400).json({ error: 'Invalid or expired verification code. Please request a new one.' });
      return;
    }

    if (otp.attempts >= 5) {
      res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
      return;
    }

    if (otp.code !== String(code).trim()) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
      return;
    }

    res.json({ valid: true, message: 'Code verified successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reset Password via OTP
router.post('/otp/reset-password', async (req, res): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, verification code, and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otp = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        purpose: OtpPurpose.PASSWORD_RESET,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
      return;
    }

    if (otp.attempts >= 5) {
      res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
      return;
    }

    if (otp.code !== String(code).trim()) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
      return;
    }

    // Mark OTP used
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      res.status(404).json({ error: 'User account not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerified: true },
    });

    // Send security notification email
    mailService.sendPasswordResetSuccessEmail({
      to: normalizedEmail,
      recipientName: user.name,
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Passwordless Login via OTP
router.post('/otp/login', async (req, res): Promise<void> => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: 'Email and verification code are required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otp = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        purpose: OtpPurpose.LOGIN,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.code !== String(code).trim()) {
      if (otp) {
        await prisma.emailOtp.update({
          where: { id: otp.id },
          data: { attempts: { increment: 1 } },
        });
      }
      res.status(400).json({ error: 'Invalid or expired verification code' });
      return;
    }

    // Mark used
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        organizationMembers: {
          include: {
            organization: { include: { workspaces: true } },
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Ensure email is marked verified
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organizations: user.organizationMembers.map((m) => ({
        ...m.organization,
        role: m.role.name,
      })),
      message: 'Signed in successfully via email verification',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
