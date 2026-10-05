import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Dashboard Overview Metrics (Live Database Telemetry)
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { orgId, workspaceId } = req.query;

    const projectFilter: any = {};
    if (orgId) {
      projectFilter.organizationId = String(orgId);
    }
    if (workspaceId) {
      projectFilter.workspaceId = String(workspaceId);
    }

    // Retrieve real projects and issues from database
    const projects = await prisma.project.findMany({
      where: projectFilter,
      include: {
        _count: { select: { issues: true } },
        issues: {
          select: {
            id: true,
            status: true,
            priority: true,
            dueDate: true,
            column: { select: { name: true } },
            assignees: { select: { userId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const allIssues = projects.flatMap((p) => p.issues);
    const totalTasks = allIssues.length;
    const inProgressCount = allIssues.filter((i) =>
      i.status === 'IN_PROGRESS' ||
      i.column?.name?.toLowerCase().includes('progress')
    ).length;
    const doneCount = allIssues.filter((i) =>
      i.status === 'DONE' ||
      i.column?.name?.toLowerCase().includes('done')
    ).length;
    const urgentCount = allIssues.filter((i) =>
      i.priority === 'URGENT' || i.priority === 'HIGH'
    ).length;
    const myAssignedCount = allIssues.filter((i) =>
      i.assignees?.some((a) => a.userId === userId)
    ).length;

    // Real dynamic progress metrics per project
    const projectStats = projects.map((p) => {
      const total = p.issues.length;
      const done = p.issues.filter((i) =>
        i.status === 'DONE' || i.column?.name?.toLowerCase().includes('done')
      ).length;
      const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        key: p.key,
        color: p.color,
        description: p.description,
        totalIssues: total,
        completedIssues: done,
        progressPercent,
      };
    });

    res.json({
      metrics: {
        totalTasks,
        inProgress: inProgressCount,
        done: doneCount,
        urgent: urgentCount,
        assigned: myAssignedCount,
      },
      projectStats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
