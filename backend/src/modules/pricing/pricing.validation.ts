import { z } from 'zod';
import { CustomerType } from '@prisma/client';

export const rateSchema = z
  .number({ required_error: 'Price rate is required' })
  .positive('Price rate must be positive')
  .refine(
    (val) => {
      // Check decimal precision (at most 2 decimal places)
      const str = val.toString();
      const decimalPart = str.split('.')[1];
      return !decimalPart || decimalPart.length <= 2;
    },
    { message: 'Price rate cannot have more than 2 decimal places' }
  );

export const createPriceSchema = z
  .object({
    productId: z.string().uuid('Valid Product ID is required'),
    packConfigId: z.string().uuid('Valid Pack Config ID is required').optional().nullable(),
    customerType: z.nativeEnum(CustomerType, {
      errorMap: () => ({ message: 'customerType must be either INDIAN or NRI' }),
    }),
    rate: rateSchema,
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      if (data.effectiveFrom && data.effectiveTo) {
        return new Date(data.effectiveTo).getTime() > new Date(data.effectiveFrom).getTime();
      }
      return true;
    },
    {
      message: 'effectiveTo must be strictly after effectiveFrom',
      path: ['effectiveTo'],
    }
  );

export const updatePriceSchema = z
  .object({
    rate: rateSchema.optional(),
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.effectiveFrom && data.effectiveTo) {
        return new Date(data.effectiveTo).getTime() > new Date(data.effectiveFrom).getTime();
      }
      return true;
    },
    {
      message: 'effectiveTo must be strictly after effectiveFrom',
      path: ['effectiveTo'],
    }
  );

export const resolvePriceSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  customerType: z.nativeEnum(CustomerType, {
    errorMap: () => ({ message: 'customerType must be either INDIAN or NRI' }),
  }),
  packConfigId: z.string().uuid().optional().nullable(),
  looseWeightInGrams: z.number().positive('Loose weight must be positive').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive').optional().default(1),
  targetDate: z.coerce.date().optional(),
});

export const resolvePricesSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  customerType: z.nativeEnum(CustomerType).optional(),
  targetDate: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Valid Product ID is required'),
        packConfigId: z.string().uuid().optional().nullable(),
        quantity: z.number().positive('Quantity must be positive'),
        looseWeightInGrams: z.number().positive('Loose weight must be positive').optional().nullable(),
      })
    )
    .min(1, 'At least one item is required in cart'),
});

export const batchUpsertPriceSchema = z.object({
  prices: z.array(createPriceSchema).min(1, 'At least one price entry is required'),
});

export const priceQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  packConfigId: z.string().uuid().optional().nullable(),
  isActive: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional())
    .optional(),
  date: z.coerce.date().optional(),
});

export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
export type ResolvePriceInput = z.infer<typeof resolvePriceSchema>;
export type ResolvePricesInput = z.infer<typeof resolvePricesSchema>;
export type BatchUpsertPriceInput = z.infer<typeof batchUpsertPriceSchema>;
export type PriceQueryInput = z.infer<typeof priceQuerySchema>;
