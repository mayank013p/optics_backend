import { z } from 'zod';

export const createIssueSchema = z.object({
  body: z.object({
    projectId: z.string().min(1, 'Project ID is required'),
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    type: z.enum(['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT']).optional(),
    columnId: z.string().optional().nullable(),
    boardId: z.string().optional().nullable(),
    estimate: z.union([z.number(), z.string()]).optional().nullable(),
    dueDate: z.string().optional().nullable(),
    assigneeIds: z.array(z.string()).optional(),
    labelIds: z.array(z.string()).optional(),
  }),
});

export const moveIssueSchema = z.object({
  body: z.object({
    destinationColumnId: z.string().optional(),
    newPosition: z.number().optional(),
  }),
});

export const updateIssueSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    type: z.enum(['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT']).optional(),
    estimate: z.union([z.number(), z.string()]).optional().nullable(),
    dueDate: z.string().optional().nullable(),
  }),
});

export const addCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment content is required'),
  }),
});
