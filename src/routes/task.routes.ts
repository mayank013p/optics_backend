import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// List Tasks
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId, boardId } = req.query;

    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    if (boardId) where.boardId = String(boardId);

    const tasks = await prisma.issue.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
        labels: { include: { label: true } },
        column: true,
        _count: { select: { comments: true, attachments: true } },
      },
    });

    res.json({ tasks, issues: tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Task
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId, title, description, priority, type, columnId, boardId, estimate, dueDate, assigneeIds, labelIds } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    let targetProjectId = projectId;
    if (!targetProjectId) {
      const firstProject = await prisma.project.findFirst();
      if (!firstProject) {
        res.status(400).json({ error: 'No projects found. Please create a project first.' });
        return;
      }
      targetProjectId = firstProject.id;
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

    const targetBoard = boardId
      ? project.boards.find((b) => b.id === boardId) || project.boards[0]
      : project.boards[0];

    const targetColumn = columnId
      ? targetBoard?.columns.find((c) => c.id === columnId) || targetBoard?.columns[0]
      : targetBoard?.columns[0];

    // Compute next task index key
    const count = await prisma.issue.count({ where: { projectId: project.id } });
    const nextNum = count + 1;
    const taskKey = `${project.key}-${nextNum}`;

    const newTask = await prisma.issue.create({
      data: {
        key: taskKey,
        title,
        description: description || null,
        priority: priority || 'MEDIUM',
        type: type || 'TASK',
        estimate: estimate ? Number(estimate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: project.id,
        boardId: targetBoard?.id || null,
        columnId: targetColumn?.id || null,
        reporterId: req.user!.id,
        assignees: assigneeIds && assigneeIds.length > 0
          ? { create: assigneeIds.map((userId: string) => ({ userId })) }
          : undefined,
        labels: labelIds && labelIds.length > 0
          ? { create: labelIds.map((labelId: string) => ({ labelId })) }
          : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
        labels: { include: { label: true } },
        column: true,
      },
    });

    // Record audit log
    await prisma.activityLog.create({
      data: {
        entityType: 'TASK',
        entityId: newTask.id,
        action: 'CREATED_TASK',
        metadata: {
          taskKey: newTask.key,
          title: newTask.title,
          columnName: targetColumn?.name || 'Backlog',
        },
        userId: req.user!.id,
        organizationId: project.organizationId,
        projectId: project.id,
      },
    });

    res.status(201).json({ task: newTask, issue: newTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Task
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = String(req.params.id);
    const { title, description, priority, type, status, estimate, dueDate, columnId, position } = req.body;

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (type !== undefined) data.type = type;
    if (status !== undefined) data.status = status;
    if (estimate !== undefined) data.estimate = estimate ? Number(estimate) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (columnId !== undefined) data.columnId = columnId;
    if (position !== undefined) data.position = Number(position);

    const updatedTask = await prisma.issue.update({
      where: { id: taskId },
      data,
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
        labels: { include: { label: true } },
        column: true,
      },
    });

    res.json({ task: updatedTask, issue: updatedTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Move Task
router.patch('/:id/move', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = String(req.params.id);
    const { destinationColumnId, newPosition } = req.body;

    if (!destinationColumnId) {
      res.status(400).json({ error: 'destinationColumnId is required' });
      return;
    }

    const column = await prisma.boardColumn.findUnique({
      where: { id: String(destinationColumnId) },
    });

    const updatedTask = await prisma.issue.update({
      where: { id: taskId },
      data: {
        columnId: destinationColumnId,
        position: newPosition !== undefined ? Number(newPosition) : undefined,
        status: column?.name.toUpperCase().replace(/\s+/g, '_') || 'IN_PROGRESS',
      },
      include: {
        column: true,
      },
    });

    // Get project orgId for activity log
    const project = await prisma.project.findUnique({
      where: { id: updatedTask.projectId },
      select: { organizationId: true },
    });

    // Record activity
    if (project) {
      await prisma.activityLog.create({
        data: {
          entityType: 'TASK',
          entityId: updatedTask.id,
          action: 'MOVED_COLUMN',
          metadata: {
            taskKey: updatedTask.key,
            issueKey: updatedTask.key,
            toColumn: column?.name || 'New Column',
          },
          userId: req.user!.id,
          organizationId: project.organizationId,
          projectId: updatedTask.projectId,
        },
      });
    }

    res.json({ task: updatedTask, issue: updatedTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Task
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = String(req.params.id);

    await prisma.issue.delete({
      where: { id: taskId },
    });

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add Comment to Task
router.post('/:id/comments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = String(req.params.id);
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    const comment = await prisma.issueComment.create({
      data: {
        content,
        issueId: taskId,
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
