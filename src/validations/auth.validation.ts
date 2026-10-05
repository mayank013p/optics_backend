import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    orgName: z.string().min(2, 'Organization name must be at least 2 characters').optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const requestOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    purpose: z.enum(['LOGIN', 'REGISTER', 'PASSWORD_RESET']).default('LOGIN'),
  }),
});

export const loginOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
  }),
});

export const registerOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    orgName: z.string().min(2, 'Organization name must be at least 2 characters').optional(),
  }),
});

export const resetPasswordOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
  }),
});

