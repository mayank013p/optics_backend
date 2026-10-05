import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// List attachments / files
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const attachments = await prisma.attachment.findMany({
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
        issue: { select: { id: true, key: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      files: attachments.map((a) => ({
        id: a.id,
        name: a.fileName,
        size: `${(a.fileSize / (1024 * 1024)).toFixed(1)} MB`,
        type: a.mimeType,
        issueKey: a.issue?.key || 'GENERAL',
        storage: 'Cloudflare R2 (S3 API)',
        uploadedAt: a.createdAt.toISOString().split('T')[0],
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record File Attachment
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, size, type, issueKey } = req.body;

    if (!name) {
      res.status(400).json({ error: 'File name is required' });
      return;
    }

    let issueId: string | null = null;
    if (issueKey) {
      const foundIssue = await prisma.issue.findFirst({
        where: { key: String(issueKey).toUpperCase().trim() },
      });
      if (foundIssue) {
        issueId = foundIssue.id;
      }
    }

    const uniqueFileKey = `attachments/${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const attachment = await prisma.attachment.create({
      data: {
        fileName: name,
        fileKey: uniqueFileKey,
        fileUrl: `https://storage.ivors.in/${uniqueFileKey}`,
        fileSize: 2400000,
        mimeType: type || 'application/octet-stream',
        uploaderId: req.user!.id,
        issueId,
      },
      include: {
        issue: true,
      },
    });

    res.status(201).json({
      file: {
        id: attachment.id,
        name: attachment.fileName,
        size: '2.4 MB',
        type: attachment.mimeType,
        issueKey: attachment.issue?.key || issueKey || 'OPT-1',
        storage: 'Cloudflare R2 (S3 API)',
        uploadedAt: 'Just now',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete File Attachment
router.delete('/:fileId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const fileId = String(req.params.fileId);

    await prisma.attachment.delete({ where: { id: fileId } });

    res.json({ success: true, message: 'File deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
