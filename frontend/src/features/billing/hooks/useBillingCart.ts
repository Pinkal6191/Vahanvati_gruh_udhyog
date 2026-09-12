import { useState, useCallback, useMemo } from 'react';
import { CustomerType } from '../../../types/common.types';
import { Customer } from '../../customers/customers.api';
import { Product } from '../../products/products.api';
import {
  BillingApi,
  PaymentMode,
  SaleRecord,
  CreateSalePayload,
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
}

export interface UseBillingCartReturn {
  items: CartItem[];
  customer: Customer | null;
  customerType: CustomerType;
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

  // Actions
  setCustomer: (customer: Customer | null) => void;
  setCustomerType: (type: CustomerType) => void;
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
  const [customerType, setCustomerTypeState] = useState<CustomerType>('INDIAN');
  const [discountAmount, setDiscountAmountState] = useState<number>(0);
  const [paidAmount, setPaidAmountState] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isResolvingPrices, setIsResolvingPrices] = useState<boolean>(false);

  // Fallback estimated totals until backend sync responds
  const estimatedSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.totalAmount, 0),
    [items]
  );
  const [serverSubtotal, setServerSubtotal] = useState<number>(0);

  const subtotal = serverSubtotal > 0 ? serverSubtotal : estimatedSubtotal;
  const grandTotal = Math.max(0, Math.round(subtotal - discountAmount));
  const changeAmount = Math.max(0, paidAmount - grandTotal);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Sync cart prices with backend authoritative pricing engine
  const syncWithBackendPricing = useCallback(
    async (currentItems: CartItem[], cType: CustomerType, cId?: string | null) => {
      if (currentItems.length === 0) {
        setServerSubtotal(0);
        return;
      }

      setIsResolvingPrices(true);
      try {
        const payload = {
          customerId: cId || undefined,
          customerType: cType,
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
              return {
                ...it,
                unitRate: match.unitRate,
                totalAmount: match.totalAmount,
                packName: it.packName || match.weightOrPackName,
              };
            }
            return it;
          })
        );
      } catch (err) {
        console.warn('Backend price resolution fallback to local estimates:', err);
      } finally {
        setIsResolvingPrices(false);
      }
    },
    []
  );

  // Customer Selection
  const setCustomer = useCallback(
    (newCust: Customer | null) => {
      setCustomerState(newCust);
      const newType = newCust?.customerType || 'INDIAN';
      setCustomerTypeState(newType);
      syncWithBackendPricing(items, newType, newCust?.id);
    },
    [items, syncWithBackendPricing]
  );

  const setCustomerType = useCallback(
    (type: CustomerType) => {
      setCustomerTypeState(type);
      syncWithBackendPricing(items, type, customer?.id);
    },
    [items, customer, syncWithBackendPricing]
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
        // Resolve initial rate from product's pricing (pack rate or base rate)
        let defaultRate = 0;
        if (packId) {
          const packPriceObj = ((product as any).prices || []).find(
            (pr: any) =>
              pr.packConfigId === packId &&
              pr.customerType === customerType &&
              pr.isActive
          );
          if (packPriceObj) {
            defaultRate = Number(packPriceObj.rate);
          }
        }
        if (defaultRate <= 0) {
          defaultRate =
            (customerType === 'NRI'
              ? product.nriPrice ?? 0
              : product.indianPrice ?? 0);
        }

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
        };
        nextItems = [...items, newItem];
      }

      setItems(nextItems);
      // Automatically tender exact amount if paidAmount was equal to previous total
      await syncWithBackendPricing(nextItems, customerType, customer?.id);
    },
    [items, customerType, customer, syncWithBackendPricing]
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
      await syncWithBackendPricing(nextItems, customerType, customer?.id);
    },
    [items, customerType, customer, syncWithBackendPricing]
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
      await syncWithBackendPricing(nextItems, customerType, customer?.id);
    },
    [items, customerType, customer, syncWithBackendPricing, updateItemQuantity]
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
      await syncWithBackendPricing(nextItems, customerType, customer?.id);
    },
    [items, customerType, customer, syncWithBackendPricing]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const nextItems = items.filter((i) => i.id !== id);
      setItems(nextItems);
      await syncWithBackendPricing(nextItems, customerType, customer?.id);
    },
    [items, customerType, customer, syncWithBackendPricing]
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

    const tender = paidAmount > 0 ? paidAmount : grandTotal;
    if (tender < grandTotal) {
      throw new Error(
        `Paid amount (₹${tender}) cannot be less than the bill total (₹${grandTotal})`
      );
    }

    setIsSubmitting(true);
    try {
      const payload: CreateSalePayload = {
        customerId: customer?.id || null,
        customerType: customerType,
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
    discountAmount,
    paymentMode,
    transactionRef,
  ]);

  return {
    items,
    customer,
    customerType,
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
    setCustomer,
    setCustomerType,
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
