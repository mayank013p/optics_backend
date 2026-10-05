import { Router } from 'express';
import authRoutes from './auth.routes';
import orgRoutes from './org.routes';
import workspaceRoutes from './workspace.routes';
import projectRoutes from './project.routes';
import boardRoutes from './board.routes';
import issueRoutes from './issue.routes';
import docRoutes from './doc.routes';
import activityRoutes from './activity.routes';
import statsRoutes from './stats.routes';
import storageRoutes from './storage.routes';
import teamRoutes from './team.routes';

const router = Router();

// API Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    product: 'Optics by Ivors',
    timestamp: new Date().toISOString(),
  });
});

// Resource Sub-Routers
router.use('/auth', authRoutes);
router.use('/organizations', orgRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/projects', projectRoutes);
router.use('/boards', boardRoutes);
router.use('/issues', issueRoutes);
router.use('/tasks', issueRoutes);
router.use('/docs', docRoutes);
router.use('/activity', activityRoutes);
router.use('/stats', statsRoutes);
router.use('/storage', storageRoutes);
router.use('/attachments', storageRoutes);
router.use('/files', storageRoutes);
router.use('/teams', teamRoutes);

export default router;
