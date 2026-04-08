import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  display_name: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  logo_url: z.string().url().optional().nullable(),
  feature_flags: z.object({
    number_search: z.boolean().default(false),
    allow_edit: z.boolean().default(false),
    allow_export: z.boolean().default(false),
    custom_dispositions: z.boolean().default(false),
    record_visibility_restrictions: z.boolean().default(false),
    sold_disposition_only: z.boolean().default(false),
  }).optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  display_name: z.string().min(2).max(100).optional(),
  slug: z.string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  logo_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional(),
  feature_flags: z.object({
    number_search: z.boolean().optional(),
    allow_edit: z.boolean().optional(),
    allow_export: z.boolean().optional(),
    custom_dispositions: z.boolean().optional(),
    record_visibility_restrictions: z.boolean().optional(),
    sold_disposition_only: z.boolean().optional(),
  }).optional(),
});

export default {
  createCompanySchema,
  updateCompanySchema,
};
