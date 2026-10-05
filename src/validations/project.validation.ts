import { z } from 'zod';

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required'),
    key: z.string().min(1, 'Project key is required'),
    description: z.string().optional().nullable(),
    organizationId: z.string().min(1, 'Organization ID is required'),
    workspaceId: z.string().min(1, 'Workspace ID is required'),
    color: z.string().optional(),
    icon: z.string().optional(),
  }),
});
