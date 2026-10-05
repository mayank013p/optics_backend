import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const requirePermission = (permissionCode: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const orgId = (req.params.orgId || req.query.orgId || req.body.orgId || req.headers['x-org-id']) as string;

      if (!orgId) {
        // If no org is specified, allow through to handler logic
        next();
        return;
      }

      // Check organization member & role permissions
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: req.user.id,
          },
        },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!member) {
        res.status(403).json({ error: 'You are not a member of this organization' });
        return;
      }

      // Org Owner bypass
      if (member.role.name === 'Organization Owner') {
        next();
        return;
      }

      const hasPerm = member.role.permissions.some(
        (rp) => rp.permission.code === permissionCode || rp.permission.code === '*'
      );

      if (!hasPerm) {
        res.status(403).json({
          error: `Forbidden: Missing required permission '${permissionCode}'`,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('RBAC Error:', error);
      res.status(500).json({ error: 'Internal authorization error' });
    }
  };
};
