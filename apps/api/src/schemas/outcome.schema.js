import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const createOutcomeSchema = z.object({
  transfer_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid('Company ID is required'),
  customer_phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  customer_name: z.string().min(2, 'Customer name is required').max(100),
  disposition_id: z.string().uuid('Disposition ID is required'),
  remarks: z.string().max(1000).optional().nullable(),
});

export const outcomeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  company_id: z.string().uuid().optional(),
  closer_id: z.string().uuid().optional(),
  disposition_id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export default {
  createOutcomeSchema,
  outcomeQuerySchema,
};
