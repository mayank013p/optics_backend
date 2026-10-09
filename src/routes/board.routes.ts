import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Get Board by Project ID
router.get('/project/:projectId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);

    const board = await prisma.board.findFirst({
      where: {
        projectId,
        project: {
          workspace: {
            members: { some: { userId: req.user!.id } },
          },
        },
      },
      include: {
        project: {
          select: { id: true, name: true, key: true, color: true, organizationId: true },
        },
        columns: {
          orderBy: { position: 'asc' },
          include: {
            issues: {
              orderBy: { position: 'asc' },
              include: {
                assignees: {
                  include: {
                    user: { select: { id: true, name: true, avatarUrl: true, email: true } },
                  },
                },
                labels: {
                  include: { label: true },
                },
                comments: {
                  include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                  orderBy: { createdAt: 'desc' },
                },
                _count: {
                  select: { comments: true, attachments: true },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      res.status(404).json({ error: 'Board not found for this project' });
      return;
    }

    const formattedBoard = {
      ...board,
      columns: board.columns.map((c) => ({
        ...c,
        tasks: c.issues,
        issues: c.issues,
      })),
    };

    res.json({ board: formattedBoard });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Board by ID with columns and populated tasks
router.get('/:boardId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        project: {
          select: { id: true, name: true, key: true, color: true, organizationId: true },
        },
        columns: {
          orderBy: { position: 'asc' },
          include: {
            issues: {
              orderBy: { position: 'asc' },
              include: {
                assignees: {
                  include: {
                    user: { select: { id: true, name: true, avatarUrl: true, email: true } },
                  },
                },
                labels: {
                  include: { label: true },
                },
                comments: {
                  include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                  orderBy: { createdAt: 'desc' },
                },
                _count: {
                  select: { comments: true, attachments: true },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    const formattedBoard = {
      ...board,
      columns: board.columns.map((c) => ({
        ...c,
        tasks: c.issues,
        issues: c.issues,
      })),
    };

    res.json({ board: formattedBoard });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add column to board
router.post('/:boardId/columns', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const { name, color, wipLimit } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Column name is required' });
      return;
    }

    const colCount = await prisma.boardColumn.count({ where: { boardId } });

    const column = await prisma.boardColumn.create({
      data: {
        name,
        boardId,
        color: color || '#6B7280',
        wipLimit: wipLimit || 0,
        position: colCount * 1000,
      },
      include: {
        issues: true,
      },
    });

    res.status(201).json({ column });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete column from board
router.delete('/:boardId/columns/:columnId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const columnId = String(req.params.columnId);

    const totalCols = await prisma.boardColumn.count({ where: { boardId } });
    if (totalCols <= 1) {
      res.status(400).json({ error: 'Cannot delete the only remaining column on a board' });
      return;
    }

    const column = await prisma.boardColumn.findUnique({
      where: { id: columnId },
      include: { _count: { select: { issues: true } } },
    });

    if (!column) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    const standardCols = ['backlog', 'todo', 'to do', 'in progress', 'review', 'done'];
    if (standardCols.includes(column.name.trim().toLowerCase())) {
      res.status(400).json({ error: `Cannot delete core sprint column "${column.name}"` });
      return;
    }

    if (column._count.issues > 0) {
      res.status(400).json({ error: `Cannot delete column containing ${column._count.issues} active task(s). Move them before deleting.` });
      return;
    }

    await prisma.boardColumn.delete({ where: { id: columnId } });

    res.json({ success: true, message: 'Column deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
