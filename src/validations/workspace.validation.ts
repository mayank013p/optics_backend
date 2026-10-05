import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Workspace name is required'),
    organizationId: z.string().min(1, 'Organization ID is required'),
  }),
});
