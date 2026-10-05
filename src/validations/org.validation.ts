import { z } from 'zod';

export const createOrgSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Organization name is required'),
  }),
});
