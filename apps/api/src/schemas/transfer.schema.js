import { z } from 'zod';

// Phone number normalization helper
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const createTransferSchema = z.object({
  closer_id: z.string().uuid('Invalid closer ID'),
  customer_name: z.string().min(2, 'Customer name is required').max(100),
  customer_phone: z.string().regex(phoneRegex, 'Invalid phone number format'),
  car_make: z.string().max(50).optional().nullable(),
  car_model: z.string().max(50).optional().nullable(),
  car_year: z.string().max(4).optional().nullable(),
  zip_code: z.string().max(10).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  miles: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateTransferSchema = z.object({
  customer_name: z.string().min(2).max(100).optional(),
  customer_phone: z.string().regex(phoneRegex).optional(),
  car_make: z.string().max(50).optional().nullable(),
  car_model: z.string().max(50).optional().nullable(),
  car_year: z.string().max(4).optional().nullable(),
  zip_code: z.string().max(10).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  miles: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const transferQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  company_id: z.string().uuid().optional(),
  fronter_id: z.string().uuid().optional(),
  closer_id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export default {
  createTransferSchema,
  updateTransferSchema,
  transferQuerySchema,
};
