import { Response } from 'express';
import { activityService } from '../services/activity.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class ActivityController {
  async getActivities(req: AuthenticatedRequest, res: Response) {
    const { orgId, projectId, limit } = req.query;
    const activities = await activityService.getActivities({
      orgId: orgId ? String(orgId) : undefined,
      projectId: projectId ? String(projectId) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    return ApiResponse.success(res, { activities });
  }
}

export const activityController = new ActivityController();
