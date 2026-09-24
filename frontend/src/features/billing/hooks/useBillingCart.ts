import { useState, useCallback, useMemo } from 'react';
import { CustomerType } from '../../../types/common.types';
import { Customer } from '../../customers/customers.api';
import { Product } from '../../products/products.api';
import {
  BillingApi,
  PaymentMode,
  SaleRecord,
  CreateSalePayload,
  SaleType,
} from '../billing.api';

export interface CartItem {
  id: string; // Unique key for list: `${productId}_${packConfigId || 'loose'}`
  productId: string;
  productName: string;
  gujaratiName?: string | null;
  productCode: string;
  packConfigId?: string | null;
  packName?: string | null;
  unitName: string;
  quantity: number;
  looseWeightInGrams?: number | null;
  unitRate: number;
  totalAmount: number;
  stockBalance?: number;
  hasPriceError?: boolean;
  priceErrorMessage?: string;
}

export interface UseBillingCartReturn {
  items: CartItem[];
  customer: Customer | null;
  customerType: CustomerType;
  saleType: SaleType;
  discountAmount: number;
  paidAmount: number;
  paymentMode: PaymentMode;
  transactionRef: string;
  isSubmitting: boolean;
  isResolvingPrices: boolean;
  subtotal: number;
  grandTotal: number;
  changeAmount: number;
  itemCount: number;
  hasMissingPriceItem: boolean;
  missingPriceItemsCount: number;

  // Actions
  setCustomer: (customer: Customer | null) => void;
  setCustomerType: (type: CustomerType) => void;
  setSaleType: (type: SaleType) => void;
  setDiscountAmount: (val: number) => void;
  setPaidAmount: (val: number) => void;
  setPaymentMode: (mode: PaymentMode) => void;
  setTransactionRef: (ref: string) => void;
  addToCart: (
    product: Product,
    options?: {
      packConfigId?: string | null;
      packName?: string | null;
      quantity?: number;
      looseWeightInGrams?: number | null;
    }
  ) => Promise<void>;
  updateItemQuantity: (id: string, delta: number) => Promise<void>;
  setItemQuantity: (id: string, qty: number) => Promise<void>;
  updateItemWeight: (id: string, grams: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => void;
  submitSale: () => Promise<SaleRecord>;
}

export function useBillingCart(): UseBillingCartReturn {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomerState] = useState<Customer | null>(null);
  const [customerType, setCustomerTypeState] = useState<CustomerType>('INDIAN'); // Demographic
  const [saleType, setSaleTypeState] = useState<SaleType>('RETAIL'); // Authoritative transaction selector
  const [discountAmount, setDiscountAmountState] = useState<number>(0);
  const [paidAmount, setPaidAmountState] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isResolvingPrices, setIsResolvingPrices] = useState<boolean>(false);

  // Missing price indicators
  const hasMissingPriceItem = useMemo(() => {
    return items.some((it) => it.unitRate <= 0 || it.hasPriceError);
  }, [items]);

  const missingPriceItemsCount = useMemo(() => {
    return items.filter((it) => it.unitRate <= 0 || it.hasPriceError).length;
  }, [items]);

  // Fallback estimated totals until backend sync responds
  const estimatedSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.hasPriceError || item.unitRate <= 0 ? 0 : item.totalAmount), 0),
    [items]
  );
  const [serverSubtotal, setServerSubtotal] = useState<number>(0);

  const subtotal = serverSubtotal > 0 ? serverSubtotal : estimatedSubtotal;
  const grandTotal = Math.max(0, Math.round(subtotal - discountAmount));
  const changeAmount = Math.max(0, paidAmount - grandTotal);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Sync cart prices with backend authoritative pricing engine
  const syncWithBackendPricing = useCallback(
    async (currentItems: CartItem[], cType: CustomerType, sType: SaleType, cId?: string | null) => {
      if (currentItems.length === 0) {
        setServerSubtotal(0);
        return;
      }

      setIsResolvingPrices(true);
      try {
        const payload = {
          customerId: cId || undefined,
          customerType: cType,
          saleType: sType,
          items: currentItems.map((item) => ({
            productId: item.productId,
            packConfigId: item.packConfigId || null,
            quantity: item.quantity,
            looseWeightInGrams: item.looseWeightInGrams || null,
          })),
        };

        const res = await BillingApi.resolveCart(payload);
        setServerSubtotal(res.subtotalAmount);

        // Update items with backend-resolved rates and snapshots
        setItems((prev) =>
          prev.map((it) => {
            const match = res.items.find(
              (r) =>
                r.productId === it.productId &&
                (r.packConfigId || null) === (it.packConfigId || null) &&
                (it.looseWeightInGrams
                  ? (r.baseWeightDeducted ? Math.round(r.baseWeightDeducted / (r.quantity || 1)) === it.looseWeightInGrams : true)
                  : true)
            );
            if (match) {
              const isInvalid = match.unitRate <= 0;
              return {
                ...it,
                unitRate: match.unitRate,
                totalAmount: match.totalAmount,
                packName: it.packName || match.weightOrPackName,
                hasPriceError: isInvalid,
                priceErrorMessage: isInvalid ? `No active ${sType} price configured` : undefined,
              };
            }
            return it;
          })
        );
      } catch (err: any) {
        console.warn('Backend price resolution failed:', err);
        // Mark items that lack local price as error
        setItems((prev) =>
          prev.map((it) => {
            if (it.unitRate <= 0) {
              return {
                ...it,
                hasPriceError: true,
                priceErrorMessage: `No active ${sType} price configured`,
              };
            }
            return it;
          })
        );
      } finally {
        setIsResolvingPrices(false);
      }
    },
    []
  );

  // Customer Selection: Updates customer demographic ONLY, does NOT change transaction saleType!
  const setCustomer = useCallback(
    (newCust: Customer | null) => {
      setCustomerState(newCust);
      const demographic = newCust?.customerType || 'INDIAN';
      setCustomerTypeState(demographic);
      // Re-resolve existing cart with current items, new demographic, and current saleType
      syncWithBackendPricing(items, demographic, saleType, newCust?.id);
    },
    [items, saleType, syncWithBackendPricing]
  );

  const setCustomerType = useCallback(
    (type: CustomerType) => {
      setCustomerTypeState(type);
      syncWithBackendPricing(items, type, saleType, customer?.id);
    },
    [items, saleType, customer, syncWithBackendPricing]
  );

  // SaleType Selection: Authoritative transaction pricing selector
  // Switching SaleType re-resolves existing cart items without discarding cart
  const setSaleType = useCallback(
    (type: SaleType) => {
      setSaleTypeState(type);
      syncWithBackendPricing(items, customerType, type, customer?.id);
    },
    [items, customerType, customer, syncWithBackendPricing]
  );

  const setDiscountAmount = useCallback((val: number) => {
    const clamped = Math.max(0, Number(val) || 0);
    setDiscountAmountState(clamped);
  }, []);

  const setPaidAmount = useCallback((val: number) => {
    const clamped = Math.max(0, Number(val) || 0);
    setPaidAmountState(clamped);
  }, []);

  // Add Product to Cart (with duplicate line item merging)
  const addToCart = useCallback(
    async (
      product: Product,
      options?: {
        packConfigId?: string | null;
        packName?: string | null;
        quantity?: number;
        looseWeightInGrams?: number | null;
      }
    ) => {
      const qtyToAdd = options?.quantity && options.quantity > 0 ? options.quantity : 1;
      const packId = options?.packConfigId || null;
      const weightGrams = options?.looseWeightInGrams || null;
      const itemId = `${product.id}_${packId || (weightGrams ? `w_${weightGrams}` : 'loose')}`;

      let nextItems: CartItem[];

      const existingIndex = items.findIndex((i) => i.id === itemId);
      if (existingIndex >= 0) {
        // MERGE INTO EXISTING CART LINE
        nextItems = items.map((it, idx) => {
          if (idx === existingIndex) {
            const nextQty = it.quantity + qtyToAdd;
            const singleItemPrice = it.looseWeightInGrams && !it.packConfigId
              ? Math.round(((it.looseWeightInGrams / 1000) * it.unitRate) * 100) / 100
              : it.unitRate;
            return {
              ...it,
              quantity: nextQty,
              totalAmount: Math.round(singleItemPrice * nextQty * 100) / 100,
            };
          }
          return it;
        });
      } else {
        // Resolve initial rate from product's pricing for current saleType (pack rate or base rate)
        let defaultRate = 0;
        if (packId) {
          const packPriceObj = ((product as any).prices || []).find(
            (pr: any) =>
              pr.packConfigId === packId &&
              (pr.pricingTier === saleType ||
                pr.customerType === saleType ||
                (saleType === 'RETAIL' && (pr.pricingTier === 'INDIAN' || pr.customerType === 'INDIAN'))) &&
              pr.isActive
          );
          if (packPriceObj) {
            defaultRate = Number(packPriceObj.rate);
          }
        }
        if (defaultRate <= 0) {
          if (saleType === 'WHOLESALE') {
            defaultRate = product.wholesalePrice ?? 0;
          } else if (saleType === 'NRI') {
            defaultRate = product.nriPrice ?? 0;
          } else {
            defaultRate = product.retailPrice ?? product.indianPrice ?? 0;
          }
        }

        const isMissingPrice = defaultRate <= 0;
        const singleItemPrice = weightGrams && !packId
          ? Math.round(((weightGrams / 1000) * defaultRate) * 100) / 100
          : defaultRate;

        const newItem: CartItem = {
          id: itemId,
          productId: product.id,
          productName: product.name,
          gujaratiName: product.gujaratiName,
          productCode: product.code,
          packConfigId: packId,
          packName: options?.packName || (packId ? 'Pack' : weightGrams ? (weightGrams >= 1000 ? `${weightGrams / 1000} kg` : `${weightGrams}g`) : 'Standard'),
          unitName: product.primaryUnit?.symbol || 'kg',
          quantity: qtyToAdd,
          looseWeightInGrams: weightGrams,
          unitRate: defaultRate,
          totalAmount: Math.round(singleItemPrice * qtyToAdd * 100) / 100,
          stockBalance: product.stock?.currentBalance,
          hasPriceError: isMissingPrice,
          priceErrorMessage: isMissingPrice ? `No active ${saleType} price configured` : undefined,
        };
        nextItems = [...items, newItem];
      }

      setItems(nextItems);
      await syncWithBackendPricing(nextItems, customerType, saleType, customer?.id);
    },
    [items, customerType, saleType, customer, syncWithBackendPricing]
  );

  // Update item quantity by delta (+1 / -1)
  const updateItemQuantity = useCallback(
    async (id: string, delta: number) => {
      let nextItems: CartItem[] = [];

      for (const it of items) {
        if (it.id === id) {
          const updatedQty = it.quantity + delta;
          if (updatedQty > 0) {
            const singleItemPrice = it.looseWeightInGrams && !it.packConfigId
              ? Math.round(((it.looseWeightInGrams / 1000) * it.unitRate) * 100) / 100
              : it.unitRate;
            nextItems.push({
              ...it,
              quantity: updatedQty,
              totalAmount: Math.round(singleItemPrice * updatedQty * 100) / 100,
            });
          }
          // If updatedQty <= 0, item is removed
        } else {
          nextItems.push(it);
        }
      }

      setItems(nextItems);
      await syncWithBackendPricing(nextItems, customerType, saleType, customer?.id);
    },
    [items, customerType, saleType, customer, syncWithBackendPricing]
  );

  const setItemQuantity = useCallback(
    async (id: string, qty: number) => {
      if (qty <= 0) {
        await updateItemQuantity(id, -9999);
        return;
      }
      const nextItems = items.map((it) => {
        if (it.id === id) {
          const singleItemPrice = it.looseWeightInGrams && !it.packConfigId
            ? Math.round(((it.looseWeightInGrams / 1000) * it.unitRate) * 100) / 100
            : it.unitRate;
          return {
            ...it,
            quantity: qty,
            totalAmount: Math.round(singleItemPrice * qty * 100) / 100,
          };
        }
        return it;
      });
      setItems(nextItems);
      await syncWithBackendPricing(nextItems, customerType, saleType, customer?.id);
    },
    [items, customerType, saleType, customer, syncWithBackendPricing, updateItemQuantity]
  );

  const updateItemWeight = useCallback(
    async (id: string, grams: number) => {
      const nextItems = items.map((it) => {
        if (it.id === id) {
          return {
            ...it,
            looseWeightInGrams: grams,
          };
        }
        return it;
      });
      setItems(nextItems);
      await syncWithBackendPricing(nextItems, customerType, saleType, customer?.id);
    },
    [items, customerType, saleType, customer, syncWithBackendPricing]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const nextItems = items.filter((i) => i.id !== id);
      setItems(nextItems);
      await syncWithBackendPricing(nextItems, customerType, saleType, customer?.id);
    },
    [items, customerType, saleType, customer, syncWithBackendPricing]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscountAmountState(0);
    setPaidAmountState(0);
    setTransactionRef('');
    setServerSubtotal(0);
  }, []);

  // Complete Bill Checkout with Duplicate Submission Guard
  const submitSale = useCallback(async (): Promise<SaleRecord> => {
    if (isSubmitting) {
      throw new Error('Transaction is already being processed. Please wait...');
    }

    if (items.length === 0) {
      throw new Error('Cart is empty. Please select products before completing the bill.');
    }

    // Missing price validation: prevent checkout while unpriced
    const unpricedItems = items.filter((it) => it.unitRate <= 0 || it.hasPriceError);
    if (unpricedItems.length > 0) {
      const names = unpricedItems.map((i) => i.productName).join(', ');
      throw new Error(
        `Cannot complete checkout: The following items do not have an active ${saleType} price configured: ${names}. Please remove them or configure their pricing.`
      );
    }

    const tender = paidAmount > 0 ? paidAmount : grandTotal;
    if (tender < grandTotal) {
      throw new Error(
        `Paid amount (₹${tender}) cannot be less than the bill total (₹${grandTotal})`
      );
    }

    setIsSubmitting(true);
    try {
      // Sends ONLY business inputs: no unitRate, no lineAmount, no subtotalAmount, no taxAmount, no finalTotalAmount
      const payload: CreateSalePayload = {
        customerId: customer?.id || null,
        customerType: customerType,
        saleType: saleType,
        items: items.map((i) => ({
          productId: i.productId,
          packConfigId: i.packConfigId || null,
          quantity: i.quantity,
          looseWeightInGrams: i.looseWeightInGrams || null,
        })),
        discountAmount,
        payments: [
          {
            paymentMode,
            amount: tender,
            transactionReference: transactionRef.trim() || null,
          },
        ],
        paidAmount: tender,
      };

      const completedSale = await BillingApi.createSale(payload);
      return completedSale;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    items,
    paidAmount,
    grandTotal,
    customer,
    customerType,
    saleType,
    discountAmount,
    paymentMode,
    transactionRef,
  ]);

  return {
    items,
    customer,
    customerType,
    saleType,
    discountAmount,
    paidAmount,
    paymentMode,
    transactionRef,
    isSubmitting,
    isResolvingPrices,
    subtotal,
    grandTotal,
    changeAmount,
    itemCount,
    hasMissingPriceItem,
    missingPriceItemsCount,
    setCustomer,
    setCustomerType,
    setSaleType,
    setDiscountAmount,
    setPaidAmount,
    setPaymentMode,
    setTransactionRef,
    addToCart,
    updateItemQuantity,
    setItemQuantity,
    updateItemWeight,
    removeItem,
    clearCart,
    submitSale,
  };
}
