import prisma from '../config/database';

export class ActivityService {
  async getActivities(params: { orgId?: string; projectId?: string; limit?: number }) {
    const { orgId, projectId, limit = 30 } = params;

    const where: any = {};
    if (orgId) where.organizationId = String(orgId);
    if (projectId) where.projectId = String(projectId);

    const activities = await prisma.activityLog.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    });

    return activities;
  }
}

export const activityService = new ActivityService();
