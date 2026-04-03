import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const createCallbackSchema = z.object({
  customer_name: z.string().min(2, 'Customer name is required').max(100),
  customer_phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  best_time: z.string().datetime('Invalid datetime format'),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateCallbackSchema = z.object({
  customer_name: z.string().min(2).max(100).optional(),
  customer_phone: z.string().regex(phoneRegex).optional(),
  best_time: z.string().datetime().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export default {
  createCallbackSchema,
  updateCallbackSchema,
};
