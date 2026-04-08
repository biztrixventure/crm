import { z } from 'zod';

export const createCloserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Full name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default {
  createCloserSchema,
};
