import { Response } from 'express';
import { workspaceService } from '../services/workspace.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class WorkspaceController {
  async createWorkspace(req: AuthenticatedRequest, res: Response) {
    const workspace = await workspaceService.createWorkspace(
      req.user!.id,
      req.body.name,
      String(req.body.organizationId)
    );
    return ApiResponse.created(res, { workspace });
  }

  async getWorkspaceDetails(req: AuthenticatedRequest, res: Response) {
    const workspace = await workspaceService.getWorkspaceDetails(String(req.params.workspaceId));
    return ApiResponse.success(res, { workspace });
  }
}

export const workspaceController = new WorkspaceController();
