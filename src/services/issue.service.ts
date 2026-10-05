import prisma from '../config/database';
import { ApiError } from '../utils/apiError';
import { Priority, IssueType } from '../types';

export interface CreateIssueDTO {
  projectId?: string;
  title: string;
  description?: string | null;
  priority?: Priority;
  type?: IssueType;
  columnId?: string | null;
  boardId?: string | null;
  estimate?: number | null;
  dueDate?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  userId: string;
}

export interface MoveIssueDTO {
  issueId: string;
  destinationColumnId?: string;
  newPosition?: number;
  userId: string;
}

export interface UpdateIssueDTO {
  issueId: string;
  title?: string;
  description?: string | null;
  priority?: Priority;
  type?: IssueType;
  status?: string;
  columnId?: string | null;
  estimate?: number | null;
  dueDate?: string | null;
}

export class IssueService {
  async listIssues(filter: { projectId?: string; boardId?: string }) {
    const where: any = {};
    if (filter.projectId) where.projectId = String(filter.projectId);
    if (filter.boardId) where.boardId = String(filter.boardId);

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } },
          },
        },
        labels: { include: { label: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        column: true,
        _count: { select: { comments: true, attachments: true } },
      },
    });

    return issues;
  }

  async createIssue(dto: CreateIssueDTO) {
    const {
      projectId,
      title,
      description,
      priority,
      type,
      columnId,
      boardId,
      estimate,
      dueDate,
      assigneeIds,
      labelIds,
      userId,
    } = dto;

    let targetProjectId = projectId;
    if (!targetProjectId) {
      const firstProject = await prisma.project.findFirst();
      if (!firstProject) {
        throw ApiError.badRequest('No projects found. Please create a project first.');
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
      throw ApiError.notFound('Project not found');
    }

    // Determine target column and board
    const targetBoardId = boardId || (project.boards.length > 0 ? project.boards[0].id : null);
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
        estimate: estimate !== undefined && estimate !== null ? Number(estimate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position: nextPos,
        projectId: project.id,
        boardId: targetBoardId ? String(targetBoardId) : null,
        columnId: targetColumnId ? String(targetColumnId) : null,
        reporterId: userId,
        assignees:
          assigneeIds && Array.isArray(assigneeIds)
            ? {
                create: assigneeIds.map((uId: string) => ({ userId: uId })),
              }
            : undefined,
        labels:
          labelIds && Array.isArray(labelIds)
            ? {
                create: labelIds.map((lId: string) => ({ labelId: lId })),
              }
            : undefined,
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
        userId,
        organizationId: project.organizationId,
        projectId: project.id,
        metadata: { issueKey: issue.key, issueTitle: issue.title },
      },
    });

    return issue;
  }

  async moveIssue(dto: MoveIssueDTO) {
    const { issueId, destinationColumnId, newPosition, userId } = dto;

    const currentIssue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true, column: true },
    });

    if (!currentIssue) {
      throw ApiError.notFound('Issue not found');
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
          userId,
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

    return updatedIssue;
  }

  async updateIssue(dto: UpdateIssueDTO) {
    const { issueId, title, description, priority, type, status, columnId, estimate, dueDate } = dto;

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        title,
        description,
        priority,
        type,
        status,
        columnId,
        estimate: estimate !== undefined ? (estimate ? Number(estimate) : null) : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        labels: { include: { label: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        column: true,
      },
    });

    return issue;
  }

  async deleteIssue(issueId: string) {
    await prisma.issue.delete({ where: { id: issueId } });
    return { success: true, message: 'Task deleted successfully' };
  }

  async addComment(issueId: string, userId: string, content: string) {
    const comment = await prisma.issueComment.create({
      data: {
        content,
        issueId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return comment;
  }
}

export const issueService = new IssueService();
