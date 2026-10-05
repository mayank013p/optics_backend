import { Response } from 'express';
import { issueService } from '../services/issue.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class IssueController {
  async listIssues(req: AuthenticatedRequest, res: Response) {
    const { projectId, boardId } = req.query;
    const issues = await issueService.listIssues({
      projectId: projectId ? String(projectId) : undefined,
      boardId: boardId ? String(boardId) : undefined,
    });
    return ApiResponse.success(res, { issues });
  }

  async createIssue(req: AuthenticatedRequest, res: Response) {
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
    } = req.body;

    const issue = await issueService.createIssue({
      projectId: projectId ? String(projectId) : undefined,
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
      userId: req.user!.id,
    });

    return ApiResponse.created(res, { issue });
  }

  async moveIssue(req: AuthenticatedRequest, res: Response) {
    const issueId = String(req.params.issueId);
    const { destinationColumnId, newPosition } = req.body;

    const issue = await issueService.moveIssue({
      issueId,
      destinationColumnId,
      newPosition,
      userId: req.user!.id,
    });

    return ApiResponse.success(res, { issue });
  }

  async updateIssue(req: AuthenticatedRequest, res: Response) {
    const issueId = String(req.params.issueId);
    const { title, description, priority, type, status, columnId, estimate, dueDate } = req.body;

    const issue = await issueService.updateIssue({
      issueId,
      title,
      description,
      priority,
      type,
      status,
      columnId,
      estimate,
      dueDate,
    });

    return ApiResponse.success(res, { issue });
  }

  async deleteIssue(req: AuthenticatedRequest, res: Response) {
    const issueId = String(req.params.issueId);
    const result = await issueService.deleteIssue(issueId);
    return ApiResponse.success(res, result);
  }

  async addComment(req: AuthenticatedRequest, res: Response) {
    const issueId = String(req.params.issueId);
    const { content } = req.body;

    const comment = await issueService.addComment(issueId, req.user!.id, content);
    return ApiResponse.created(res, { comment });
  }
}

export const issueController = new IssueController();
