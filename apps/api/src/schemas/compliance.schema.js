import { z } from 'zod';

export const createBatchSchema = z.object({
  company_id: z.string().uuid('Invalid company ID'),
  date_from: z.string().date('Invalid date format (use YYYY-MM-DD)'),
  date_to: z.string().date('Invalid date format (use YYYY-MM-DD)'),
  assign_to: z.string().uuid('Invalid user ID').optional().nullable(),
});

export const submitReviewSchema = z.object({
  batch_id: z.string().uuid('Invalid batch ID'),
  closer_record_id: z.string().uuid('Invalid record ID'),
  status: z.enum(['approved', 'issue_found', 'pending']),
  flag_reason: z.enum([
    'Wrong VIN',
    'Wrong Reference No',
    'Wrong Plan',
    'Missing Info',
    'Duplicate',
    'Other',
  ]).optional().nullable(),
  flag_notes: z.string().optional().nullable(),
});

export const addDncSchema = z.object({
  phone_number: z.string().min(10, 'Invalid phone number'),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const completeBatchSchema = z.object({});

export default {
  createBatchSchema,
  submitReviewSchema,
  addDncSchema,
  completeBatchSchema,
};
