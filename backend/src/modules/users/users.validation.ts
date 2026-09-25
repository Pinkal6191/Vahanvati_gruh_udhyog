import { z } from 'zod';
import { Role, SaleType } from '@prisma/client';

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').optional().nullable(),
  role: z.nativeEnum(Role, { errorMap: () => ({ message: 'Invalid role' }) }),
  isMasterAdmin: z.boolean().optional().default(false),
  allowedBillingSaleTypes: z.array(z.nativeEnum(SaleType)).optional(),
  allowedReportSaleTypes: z.array(z.nativeEnum(SaleType)).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address').optional().nullable(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  isMasterAdmin: z.boolean().optional(),
  allowedBillingSaleTypes: z.array(z.nativeEnum(SaleType)).optional(),
  allowedReportSaleTypes: z.array(z.nativeEnum(SaleType)).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
