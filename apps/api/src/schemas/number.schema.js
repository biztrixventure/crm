import { z } from 'zod';

export const assignNumbersSchema = z.object({
  list_id: z.string().uuid('Invalid list ID'),
  fronter_id: z.string().uuid('Invalid fronter ID'),
  from_row: z.number().int().min(1, 'From row must be at least 1'),
  to_row: z.number().int().min(1, 'To row must be at least 1'),
}).refine(data => data.to_row >= data.from_row, {
  message: 'To row must be greater than or equal to from row',
  path: ['to_row'],
});

export default {
  assignNumbersSchema,
};
