import { Response } from 'express';
import { projectService } from '../services/project.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class ProjectController {
  async listProjects(req: AuthenticatedRequest, res: Response) {
    const projects = await projectService.listProjects();
    return ApiResponse.success(res, { projects });
  }

  async createProject(req: AuthenticatedRequest, res: Response) {
    const { name, key, description, organizationId, workspaceId, color, icon } = req.body;
    const project = await projectService.createProject({
      name,
      key,
      description,
      organizationId: organizationId ? String(organizationId) : undefined,
      workspaceId: workspaceId ? String(workspaceId) : undefined,
      color,
      icon,
      userId: req.user!.id,
    });
    return ApiResponse.created(res, { project });
  }

  async getProjectDetails(req: AuthenticatedRequest, res: Response) {
    const project = await projectService.getProjectDetails(String(req.params.projectId));
    return ApiResponse.success(res, { project });
  }
}

export const projectController = new ProjectController();
