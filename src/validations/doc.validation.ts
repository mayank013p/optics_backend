import { z } from 'zod';

export const createDocSchema = z.object({
  body: z.object({
    projectId: z.string().min(1, 'Project ID is required'),
    title: z.string().min(1, 'Document title is required'),
    content: z.string().optional(),
    icon: z.string().optional(),
  }),
});

export const updateDocSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    icon: z.string().optional(),
  }),
});
