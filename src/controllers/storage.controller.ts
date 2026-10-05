import { Response } from 'express';
import { attachmentService } from '../services/attachment.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class StorageController {
  async listAttachments(req: AuthenticatedRequest, res: Response) {
    const files = await attachmentService.listAttachments();
    return ApiResponse.success(res, { files });
  }

  async createAttachment(req: AuthenticatedRequest, res: Response) {
    const { name, size, type, issueKey } = req.body;
    const file = await attachmentService.createAttachment({
      name,
      size,
      type,
      issueKey,
      userId: req.user!.id,
    });
    return ApiResponse.created(res, { file });
  }

  async deleteAttachment(req: AuthenticatedRequest, res: Response) {
    const result = await attachmentService.deleteAttachment(String(req.params.fileId));
    return ApiResponse.success(res, result);
  }
}

export const storageController = new StorageController();
