import prisma from '../config/database';

export class StatsService {
  async getDashboardStats(userId: string, orgId?: string) {
    const assignedCount = await prisma.issueAssignee.count({
      where: { userId },
    });

    const inProgressCount = await prisma.issue.count({
      where: {
        assignees: { some: { userId } },
        column: { name: { contains: 'Progress', mode: 'insensitive' } },
      },
    });

    const doneCount = await prisma.issue.count({
      where: {
        assignees: { some: { userId } },
        column: { name: { contains: 'Done', mode: 'insensitive' } },
      },
    });

    const overdueCount = await prisma.issue.count({
      where: {
        assignees: { some: { userId } },
        dueDate: { lt: new Date() },
        NOT: { column: { name: { contains: 'Done', mode: 'insensitive' } } },
      },
    });

    // Project health metrics for the org
    const projects = await prisma.project.findMany({
      where: orgId ? { organizationId: String(orgId) } : {},
      include: {
        _count: { select: { issues: true } },
        issues: {
          select: {
            column: { select: { name: true } },
          },
        },
      },
    });

    const projectStats = projects.map((p) => {
      const total = p.issues.length;
      const done = p.issues.filter((i) => i.column?.name?.toLowerCase().includes('done')).length;
      const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        key: p.key,
        color: p.color,
        totalIssues: total,
        completedIssues: done,
        progressPercent,
      };
    });

    return {
      metrics: {
        assigned: assignedCount,
        inProgress: inProgressCount,
        done: doneCount,
        overdue: overdueCount,
      },
      projectStats,
    };
  }
}

export const statsService = new StatsService();
