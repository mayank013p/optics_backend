import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// List Issues / Tasks (scoped to user's projects)
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId, boardId } = req.query;

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
      res.json({ issues: [] });
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
    if (boardId) where.boardId = String(boardId);

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
        labels: { include: { label: true } },
        column: true,
        _count: { select: { comments: true, attachments: true } },
      },
    });

    res.json({ issues });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Issue / Task
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId, title, description, priority, type, columnId, boardId, estimate, dueDate, assigneeIds, labelIds } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    let targetProjectId = projectId;
    if (!targetProjectId) {
      const userWorkspaces = await prisma.workspaceMember.findMany({
        where: { userId: req.user!.id },
        select: { workspaceId: true },
      });
      const allowedWsIds = userWorkspaces.map((w) => w.workspaceId);
      const userFirstProj = await prisma.project.findFirst({
        where: { workspaceId: { in: allowedWsIds } },
      });
      if (!userFirstProj) {
        res.status(400).json({ error: 'No projects found. Please create a project first.' });
        return;
      }
      targetProjectId = userFirstProj.id;
    }

    const project = await prisma.project.findUnique({
      where: { id: String(targetProjectId) },
      include: {
        boards: {
          include: {
            columns: { orderBy: { position: 'asc' } },
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Determine target column and board
    let targetBoardId = boardId || (project.boards.length > 0 ? project.boards[0].id : null);
    let targetColumnId = columnId;

    if (!targetColumnId && project.boards.length > 0 && project.boards[0].columns.length > 0) {
      targetColumnId = project.boards[0].columns[0].id;
    }

    // Generate Issue Key (e.g. OPT-101)
    const issueCount = await prisma.issue.count({ where: { projectId: project.id } });
    const issueKey = `${project.key}-${issueCount + 1}`;

    const maxPos = await prisma.issue.aggregate({
      where: { columnId: targetColumnId ? String(targetColumnId) : undefined },
      _max: { position: true },
    });
    const nextPos = (maxPos._max.position || 0) + 1000;

    const issue = await prisma.issue.create({
      data: {
        key: issueKey,
        title,
        description,
        priority: priority || 'MEDIUM',
        type: type || 'TASK',
        status: 'TODO',
        estimate: estimate ? parseInt(estimate, 10) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position: nextPos,
        projectId: project.id,
        boardId: targetBoardId ? String(targetBoardId) : null,
        columnId: targetColumnId ? String(targetColumnId) : null,
        reporterId: req.user!.id,
        assignees: assigneeIds && Array.isArray(assigneeIds) ? {
          create: assigneeIds.map((userId: string) => ({ userId })),
        } : undefined,
        labels: labelIds && Array.isArray(labelIds) ? {
          create: labelIds.map((labelId: string) => ({ labelId })),
        } : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
        labels: { include: { label: true } },
        comments: { include: { user: true } },
        column: true,
      },
    });

    // Record Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'TASK',
        entityId: issue.id,
        action: 'CREATED_TASK',
        userId: req.user!.id,
        organizationId: project.organizationId,
        projectId: project.id,
        metadata: { issueKey: issue.key, issueTitle: issue.title },
      },
    });

    res.status(201).json({ issue });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Move Issue (Drag & drop across columns or reorder inside column)
router.patch('/:issueId/move', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const issueId = String(req.params.issueId);
    const { destinationColumnId, newPosition } = req.body;

    const currentIssue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true, column: true },
    });

    if (!currentIssue) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        columnId: destinationColumnId ? String(destinationColumnId) : currentIssue.columnId,
        position: typeof newPosition === 'number' ? newPosition : currentIssue.position,
      },
      include: {
        column: true,
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        labels: { include: { label: true } },
        comments: { include: { user: true } },
      },
    });

    // If moved to a different column, record activity
    if (destinationColumnId && destinationColumnId !== currentIssue.columnId) {
      await prisma.activityLog.create({
        data: {
          entityType: 'TASK',
          entityId: updatedIssue.id,
          action: 'MOVED_COLUMN',
          userId: req.user!.id,
          organizationId: currentIssue.project.organizationId,
          projectId: currentIssue.projectId,
          metadata: {
            issueKey: updatedIssue.key,
            fromColumn: currentIssue.column?.name,
            toColumn: updatedIssue.column?.name,
          },
        },
      });
    }

    res.json({ issue: updatedIssue });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Issue details (title, description, priority, status, etc.)
router.patch('/:issueId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const issueId = String(req.params.issueId);
    const { title, description, priority, type, status, estimate, dueDate, columnId } = req.body;

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        title,
        description,
        priority,
        type,
        status,
        columnId,
        estimate: estimate !== undefined ? (estimate ? parseInt(estimate, 10) : null) : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        labels: { include: { label: true } },
        column: true,
      },
    });

    res.json({ issue });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Issue / Task
router.delete('/:issueId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const issueId = String(req.params.issueId);

    await prisma.issueComment.deleteMany({ where: { issueId } });
    await prisma.issueAssignee.deleteMany({ where: { issueId } });
    await prisma.issueLabelAssignment.deleteMany({ where: { issueId } });
    await prisma.attachment.deleteMany({ where: { issueId } });

    await prisma.issue.delete({ where: { id: issueId } });

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment to issue
router.post('/:issueId/comments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const issueId = String(req.params.issueId);
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    const comment = await prisma.issueComment.create({
      data: {
        content,
        issueId,
        userId: req.user!.id,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
