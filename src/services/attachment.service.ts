import prisma from '../config/database';
import { ApiError } from '../utils/apiError';

export class AttachmentService {
  async listAttachments() {
    const attachments = await prisma.attachment.findMany({
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
        issue: { select: { id: true, key: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attachments.map((a) => ({
      id: a.id,
      name: a.fileName,
      size: `${(a.fileSize / (1024 * 1024)).toFixed(1)} MB`,
      type: a.mimeType,
      issueKey: a.issue?.key || 'GENERAL',
      storage: 'Cloudflare R2 / Local',
      uploadedAt: a.createdAt.toISOString().split('T')[0],
    }));
  }

  async createAttachment(params: { name: string; size?: number; type?: string; issueKey?: string; userId: string }) {
    const { name, size, type, issueKey, userId } = params;

    let issueId: string | null = null;
    if (issueKey) {
      const foundIssue = await prisma.issue.findFirst({
        where: { key: String(issueKey).toUpperCase().trim() },
      });
      if (foundIssue) {
        issueId = foundIssue.id;
      }
    }

    const uniqueKey = `${Date.now()}-${name.replace(/\s+/g, '_')}`;

    const attachment = await prisma.attachment.create({
      data: {
        fileName: name,
        fileKey: uniqueKey,
        fileUrl: `/uploads/${uniqueKey}`,
        fileSize: size || 2400000,
        mimeType: type || 'application/octet-stream',
        uploaderId: userId,
        issueId,
      },
      include: {
        issue: true,
      },
    });

    return {
      id: attachment.id,
      name: attachment.fileName,
      size: `${(attachment.fileSize / (1024 * 1024)).toFixed(1)} MB`,
      type: attachment.mimeType,
      issueKey: attachment.issue?.key || issueKey || 'OPT-1',
      storage: 'Cloudflare R2 / Local',
      uploadedAt: 'Just now',
    };
  }

  async deleteAttachment(fileId: string) {
    const found = await prisma.attachment.findUnique({ where: { id: fileId } });
    if (!found) {
      throw ApiError.notFound('Attachment not found');
    }
    await prisma.attachment.delete({ where: { id: fileId } });
    return { success: true, message: 'File deleted' };
  }
}

export const attachmentService = new AttachmentService();
