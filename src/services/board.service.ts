import prisma from '../config/database';
import { ApiError } from '../utils/apiError';

export class BoardService {
  async getBoardByProjectId(projectId: string) {
    const board = await prisma.board.findFirst({
      where: { projectId },
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
      throw ApiError.notFound('Board not found for this project');
    }

    return board;
  }

  async getBoardDetails(boardId: string) {
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
      throw ApiError.notFound('Board not found');
    }

    return board;
  }

  async addColumn(boardId: string, name: string, color?: string, wipLimit?: number) {
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

    return column;
  }

  async deleteColumn(columnId: string) {
    await prisma.issue.deleteMany({ where: { columnId } });
    await prisma.boardColumn.delete({ where: { id: columnId } });
    return { success: true, message: 'Column deleted' };
  }
}

export const boardService = new BoardService();
