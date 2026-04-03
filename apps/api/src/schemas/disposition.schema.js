import { z } from 'zod';

export const createDispositionSchema = z.object({
  label: z.string().min(2, 'Label is required').max(50),
  is_default: z.boolean().default(false),
});

export const updateDispositionSchema = z.object({
  label: z.string().min(2).max(50).optional(),
  is_active: z.boolean().optional(),
});

export default {
  createDispositionSchema,
  updateDispositionSchema,
};
