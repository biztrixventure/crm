import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const totpVerifySchema = z.object({
  token: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const totpConfirmSchema = z.object({
  code: z.string().length(6, 'TOTP code must be 6 digits'),
});

export default {
  loginSchema,
  totpVerifySchema,
  totpConfirmSchema,
};
