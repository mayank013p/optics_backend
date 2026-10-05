import { Response } from 'express';
import { docService } from '../services/doc.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class DocController {
  async listDocuments(req: AuthenticatedRequest, res: Response) {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const documents = await docService.listDocuments(projectId);
    return ApiResponse.success(res, { documents });
  }

  async getProjectDocs(req: AuthenticatedRequest, res: Response) {
    const documents = await docService.getProjectDocs(String(req.params.projectId));
    return ApiResponse.success(res, { documents });
  }

  async createDoc(req: AuthenticatedRequest, res: Response) {
    const { projectId, title, content, icon } = req.body;
    const document = await docService.createDoc({
      projectId,
      title,
      content,
      icon,
      authorId: req.user!.id,
    });
    return ApiResponse.created(res, { document });
  }

  async updateDoc(req: AuthenticatedRequest, res: Response) {
    const { title, content, icon } = req.body;
    const document = await docService.updateDoc(String(req.params.docId), {
      title,
      content,
      icon,
    });
    return ApiResponse.success(res, { document });
  }

  async deleteDoc(req: AuthenticatedRequest, res: Response) {
    const result = await docService.deleteDoc(String(req.params.docId));
    return ApiResponse.success(res, result);
  }
}

export const docController = new DocController();
