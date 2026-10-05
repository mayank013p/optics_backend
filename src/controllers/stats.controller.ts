import { Response } from 'express';
import { statsService } from '../services/stats.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class StatsController {
  async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    const orgId = req.query.orgId ? String(req.query.orgId) : undefined;
    const result = await statsService.getDashboardStats(req.user!.id, orgId);
    return ApiResponse.success(res, result);
  }
}

export const statsController = new StatsController();
