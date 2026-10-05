import { Response } from 'express';
import { orgService } from '../services/org.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class OrgController {
  async listUserOrganizations(req: AuthenticatedRequest, res: Response) {
    const organizations = await orgService.listUserOrganizations(req.user!.id);
    return ApiResponse.success(res, { organizations });
  }

  async createOrganization(req: AuthenticatedRequest, res: Response) {
    const organization = await orgService.createOrganization(req.user!.id, req.body.name);
    return ApiResponse.created(res, { organization });
  }

  async getOrganizationDetails(req: AuthenticatedRequest, res: Response) {
    const organization = await orgService.getOrganizationDetails(String(req.params.orgId));
    return ApiResponse.success(res, { organization });
  }
}

export const orgController = new OrgController();
