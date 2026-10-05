import { Response } from 'express';
import { teamService } from '../services/team.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class TeamController {
  async listMembers(req: AuthenticatedRequest, res: Response) {
    const members = await teamService.listMembers();
    return ApiResponse.success(res, { members });
  }

  async inviteMember(req: AuthenticatedRequest, res: Response) {
    const { name, email, role, team } = req.body;
    const result = await teamService.inviteMember({ name, email, role, team, inviterName: req.user?.name });
    return ApiResponse.created(res, result);
  }

  async updateMemberRole(req: AuthenticatedRequest, res: Response) {
    const result = await teamService.updateMemberRole(String(req.params.userId), req.body.role);
    return ApiResponse.success(res, result);
  }

  async removeMember(req: AuthenticatedRequest, res: Response) {
    const result = await teamService.removeMember(String(req.params.userId));
    return ApiResponse.success(res, result);
  }
}

export const teamController = new TeamController();
