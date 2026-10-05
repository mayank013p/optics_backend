import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Get Activity Log Stream for an Organization / Workspace / Project
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orgId, projectId, limit = '30' } = req.query;

    const where: any = {};
    if (orgId) where.organizationId = String(orgId);
    if (projectId) where.projectId = String(projectId);

    const activities = await prisma.activityLog.findMany({
      where,
      take: Math.min(parseInt(String(limit), 10), 100),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    res.json({ activities });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
