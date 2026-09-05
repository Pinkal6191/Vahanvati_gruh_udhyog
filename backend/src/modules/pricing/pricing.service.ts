import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { CustomerType } from '@prisma/client';
import { UpsertPriceInput, ResolvePricesInput } from './pricing.validation.js';

export interface ResolvedCartItem {
  productId: string;
  productName: string;
  gujaratiName?: string | null;
  packConfigId?: string | null;
  weightOrPackName: string;
  unitSymbol: string;
  quantity: number;
  baseWeightDeducted: number; // in Grams or Pieces
  unitRate: number; // Authoritative rate snapshot
  totalAmount: number;
}

export class PricingService {
  static async getProductPrices(productId: string) {
    return prisma.productPrice.findMany({
      where: { productId, isActive: true },
      include: { packConfig: true },
    });
  }

  static async upsertPrice(input: UpsertPriceInput) {
    const { productId, packConfigId, customerType, rate } = input;

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (packConfigId) {
      const packConfig = await prisma.productPackConfiguration.findUnique({
        where: { id: packConfigId },
      });
      if (!packConfig || packConfig.productId !== productId) {
        throw new BadRequestError('Pack configuration does not belong to this product');
      }
    }

    return prisma.productPrice.upsert({
      where: {
        unique_product_pack_price: {
          productId,
          packConfigId: packConfigId ?? (null as any),
          customerType: customerType as CustomerType,
        },
      },
      update: { rate, isActive: true },
      create: {
        productId,
        packConfigId: packConfigId ?? null,
        customerType: customerType as CustomerType,
        rate,
        isActive: true,
      },
    });
  }

  static async batchUpsert(prices: UpsertPriceInput[]) {
    const results = [];
    for (const p of prices) {
      results.push(await this.upsertPrice(p));
    }
    return results;
  }

  /**
   * Internal authoritative price resolver.
   * Resolves exact rates for items based on customer tier.
   * Never exposes tier names or differential margins to invoice outputs.
   */
  static async resolveCart(input: ResolvePricesInput): Promise<{
    customerId: string;
    customerType: CustomerType;
    customerName: string;
    customerMobile?: string | null;
    items: ResolvedCartItem[];
    subtotalAmount: number;
    finalTotalAmount: number;
  }> {
    let customerType: CustomerType = CustomerType.INDIAN;
    let customerId = input.customerId;
    let customerName = 'Walk-in Customer';
    let customerMobile: string | null = null;

    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (customer && customer.isActive) {
        customerType = customer.customerType;
        customerName = customer.name;
        customerMobile = customer.mobile;
      }
    } else {
      // Find system default walk-in customer
      const defaultCustomer = await prisma.customer.findFirst({
        where: { name: 'Walk-in Customer' },
      });
      if (defaultCustomer) {
        customerId = defaultCustomer.id;
        customerType = defaultCustomer.customerType;
        customerName = defaultCustomer.name;
        customerMobile = defaultCustomer.mobile;
      }
    }

    const resolvedItems: ResolvedCartItem[] = [];
    let subtotalAmount = 0;

    for (const item of input.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          primaryUnit: true,
          packConfigurations: true,
          prices: { where: { isActive: true } },
        },
      });

      if (!product || !product.isActive) {
        throw new BadRequestError(`Product with ID ${item.productId} is not available for sale`);
      }

      let unitRate = 0;
      let totalAmount = 0;
      let weightOrPackName = '';
      let baseWeightDeducted = 0;

      if (item.packConfigId) {
        // Standard Pack variant (e.g. 500 GM pack or 1 KG pack)
        const pack = product.packConfigurations.find((p) => p.id === item.packConfigId);
        if (!pack || !pack.isActive) {
          throw new BadRequestError(`Invalid pack configuration for product: ${product.name}`);
        }

        // Lookup price for pack & customer tier
        let priceEntry = product.prices.find(
          (pr) => pr.packConfigId === pack.id && pr.customerType === customerType
        );

        // Fallback to INDIAN rate if NRI rate is not defined
        if (!priceEntry && customerType === CustomerType.NRI) {
          priceEntry = product.prices.find(
            (pr) => pr.packConfigId === pack.id && pr.customerType === CustomerType.INDIAN
          );
        }

        if (!priceEntry) {
          throw new BadRequestError(`Price not configured for ${product.name} (${pack.packName})`);
        }

        unitRate = Number(priceEntry.rate);
        totalAmount = Math.round(unitRate * item.quantity * 100) / 100;
        weightOrPackName = pack.packName;
        baseWeightDeducted = Number(pack.weightInBaseUnits) * item.quantity;
      } else if (item.looseWeightInGrams) {
        // Loose weight (e.g., 340 grams)
        if (!product.isLooseWeightAllowed) {
          throw new BadRequestError(`Loose weight selling is not allowed for: ${product.name}`);
        }

        // Base rate per KG (packConfigId is null)
        let priceEntry = product.prices.find(
          (pr) => pr.packConfigId === null && pr.customerType === customerType
        );

        if (!priceEntry && customerType === CustomerType.NRI) {
          priceEntry = product.prices.find(
            (pr) => pr.packConfigId === null && pr.customerType === CustomerType.INDIAN
          );
        }

        if (!priceEntry) {
          throw new BadRequestError(`Base per-kg rate not configured for ${product.name}`);
        }

        unitRate = Number(priceEntry.rate); // Rate per KG
        // Loose calculation: (grams / 1000) * rate
        totalAmount = Math.round(((item.looseWeightInGrams / 1000) * unitRate) * 100) / 100;
        weightOrPackName = `${item.looseWeightInGrams} GM (Loose)`;
        baseWeightDeducted = item.looseWeightInGrams;
      } else {
        // Quantity-based item or standard piece count
        let priceEntry = product.prices.find(
          (pr) => pr.packConfigId === null && pr.customerType === customerType
        );

        if (!priceEntry && customerType === CustomerType.NRI) {
          priceEntry = product.prices.find(
            (pr) => pr.packConfigId === null && pr.customerType === CustomerType.INDIAN
          );
        }

        if (!priceEntry) {
          throw new BadRequestError(`Rate not configured for ${product.name}`);
        }

        unitRate = Number(priceEntry.rate);
        totalAmount = Math.round(unitRate * item.quantity * 100) / 100;
        weightOrPackName = `${item.quantity} ${product.primaryUnit.symbol}`;
        baseWeightDeducted = item.quantity;
      }

      subtotalAmount += totalAmount;

      resolvedItems.push({
        productId: product.id,
        productName: product.name,
        gujaratiName: product.gujaratiName,
        packConfigId: item.packConfigId || null,
        weightOrPackName,
        unitSymbol: product.primaryUnit.symbol,
        quantity: item.quantity,
        baseWeightDeducted,
        unitRate,
        totalAmount,
      });
    }

    // Round total amount to nearest rupee (ROUND_HALF_UP) as approved in BD-4
    const finalTotalAmount = Math.round(subtotalAmount);

    return {
      customerId: customerId!,
      customerType,
      customerName,
      customerMobile,
      items: resolvedItems,
      subtotalAmount,
      finalTotalAmount,
    };
  }
}
