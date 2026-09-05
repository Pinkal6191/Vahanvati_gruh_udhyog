import { z } from 'zod';

export const upsertPriceSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  packConfigId: z.string().uuid().optional().nullable(),
  customerType: z.enum(['INDIAN', 'NRI']),
  rate: z.number().positive('Rate must be positive'),
});

export const batchUpsertPriceSchema = z.object({
  prices: z.array(upsertPriceSchema).min(1, 'At least one price entry is required'),
});

export const resolvePricesSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid('Valid Product ID is required'),
      packConfigId: z.string().uuid().optional().nullable(),
      quantity: z.number().positive('Quantity must be positive'),
      looseWeightInGrams: z.number().positive().optional().nullable(),
    })
  ).min(1, 'At least one item is required in cart'),
});

export type UpsertPriceInput = z.infer<typeof upsertPriceSchema>;
export type BatchUpsertPriceInput = z.infer<typeof batchUpsertPriceSchema>;
export type ResolvePricesInput = z.infer<typeof resolvePricesSchema>;
