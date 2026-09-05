import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(100, 'Name cannot exceed 100 characters').trim(),
  customerType: z.enum(['INDIAN', 'NRI'], {
    errorMap: () => ({ message: 'Customer type must strictly be INDIAN or NRI' }),
  }).default('INDIAN'),
  mobile: z
    .string()
    .regex(/^[0-9+ ]{7,16}$/, 'Invalid mobile number format')
    .optional()
    .nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  country: z.string().max(50).default('India'),
  gstin: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const updateCustomerStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean status is required' }),
});

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(['INDIAN', 'NRI']).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
