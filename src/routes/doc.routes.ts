import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';
import {
  broadcastDocCreated,
  broadcastDocUpdated,
  broadcastDocDeleted,
} from '../sockets/boardSocket';

const router = Router();
router.use(authenticateJWT);

// Get All Documents (scoped to user's projects)
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;

    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.id },
      select: { workspaceId: true },
    });
    const allowedWsIds = userWorkspaces.map((w) => w.workspaceId);

    const userProjects = await prisma.project.findMany({
      where: { workspaceId: { in: allowedWsIds } },
      select: { id: true },
    });
    const allowedProjIds = userProjects.map((p) => p.id);

    if (allowedProjIds.length === 0) {
      res.json({ documents: [] });
      return;
    }

    const where: any = { projectId: { in: allowedProjIds } };
    if (projectId) {
      if (!allowedProjIds.includes(String(projectId))) {
        res.status(403).json({ error: 'Access denied: Project not found or unauthorized' });
        return;
      }
      where.projectId = String(projectId);
    }

    const docs = await prisma.document.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ documents: docs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Documents for a Project
router.get('/project/:projectId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);

    const docs = await prisma.document.findMany({
      where: { projectId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ documents: docs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Document
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId, title, content, icon } = req.body;

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    let targetProjectId = projectId;
    if (!targetProjectId) {
      const firstProject = await prisma.project.findFirst();
      if (firstProject) {
        targetProjectId = firstProject.id;
      }
    }

    const doc = await prisma.document.create({
      data: {
        title,
        content: content || '# ' + title + '\n\nStart writing documentation...',
        icon: icon || 'file-text',
        projectId: targetProjectId,
        authorId: req.user!.id,
        isPublished: true,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
    });

    // Real-time WebSocket sync
    if (targetProjectId) {
      broadcastDocCreated({ doc, projectId: targetProjectId });
    }

    res.status(201).json({ document: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Document Content
router.patch('/:docId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const docId = String(req.params.docId);
    const { title, content, icon } = req.body;

    const doc = await prisma.document.update({
      where: { id: docId },
      data: {
        title,
        content,
        icon,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
    });

    // Real-time WebSocket sync
    if (doc.projectId) {
      broadcastDocUpdated({ doc, projectId: doc.projectId });
    }

    res.json({ document: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Document
router.delete('/:docId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const docId = String(req.params.docId);

    const existing = await prisma.document.findUnique({
      where: { id: docId },
      select: { projectId: true },
    });

    await prisma.document.delete({ where: { id: docId } });

    // Real-time WebSocket sync
    if (existing?.projectId) {
      broadcastDocDeleted({ docId, projectId: existing.projectId });
    }

    res.json({ success: true, message: 'Document deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
