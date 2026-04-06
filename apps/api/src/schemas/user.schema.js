import { z } from 'zod';

const roles = ['super_admin', 'readonly_admin', 'company_admin', 'closer', 'fronter', 'closer_manager', 'operations_manager', 'compliance_manager', 'compliance_agent'];

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(roles, { 
    errorMap: () => ({ message: `Role must be one of: ${roles.join(', ')}` })
  }),
  company_id: z.string().uuid().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  full_name: z.string().min(2).max(100).optional(),
  role: z.enum(roles).optional(),
  company_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

export default {
  createUserSchema,
  updateUserSchema,
};
