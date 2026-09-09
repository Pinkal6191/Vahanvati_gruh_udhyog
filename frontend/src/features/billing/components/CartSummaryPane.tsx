import React, { useState } from 'react';
import {
  User,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  ShoppingBag,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { CartItem } from '../hooks/useBillingCart';
import { Customer } from '../../customers/customers.api';
import { CustomerType } from '../../../types/common.types';
import { PaymentMode } from '../billing.api';
import { Badge } from '../../../components/ui/Badge/Badge';
import { formatCurrency } from '../../../utils/formatters';

export interface CartSummaryPaneProps {
  items: CartItem[];
  customer: Customer | null;
  customerType: CustomerType;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMode: PaymentMode;
  transactionRef: string;
  isSubmitting: boolean;
  isResolvingPrices: boolean;
  onOpenCustomerModal: () => void;
  onClearCustomer: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onSetDiscountAmount: (val: number) => void;
  onSetPaidAmount: (val: number) => void;
  onSetPaymentMode: (mode: PaymentMode) => void;
  onSetTransactionRef: (ref: string) => void;
  onSubmitSale: () => void;
}

export const CartSummaryPane: React.FC<CartSummaryPaneProps> = ({
  items,
  customer,
  customerType,
  subtotal,
  discountAmount,
  grandTotal,
  paidAmount,
  changeAmount,
  paymentMode,
  transactionRef,
  isSubmitting,
  isResolvingPrices,
  onOpenCustomerModal,
  onClearCustomer,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveItem,
  onClearCart,
  onSetDiscountAmount,
  onSetPaidAmount,
  onSetPaymentMode,
  onSetTransactionRef,
  onSubmitSale,
}) => {
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(discountAmount > 0);

  // Quick cash tender helper presets
  const handleQuickTender = (extra: number) => {
    if (extra === 0) {
      onSetPaidAmount(grandTotal);
    } else {
      onSetPaidAmount(grandTotal + extra);
    }
  };

  return (
    <div className="pos-cart-content">
      {/* 1. CUSTOMER SELECTION BAR */}
      <div className="pos-customer-banner">
        <div className="pos-customer-profile">
          <div className="pos-customer-icon-wrap">
            <User size={18} />
          </div>
          <div className="pos-customer-meta">
            <div className="pos-customer-name-line">
              <strong className="pos-active-customer-name">
                {customer?.name || 'Counter Walk-in Customer'}
              </strong>
              <Badge
                variant={customerType === 'NRI' ? 'warning' : 'brand'}
                size="sm"
              >
                {customerType}
              </Badge>
            </div>
            <span className="pos-active-customer-sub">
              {customer?.mobile ? `+91 ${customer.mobile}` : 'Standard Domestic Pricing'}
            </span>
          </div>
        </div>

        <div className="pos-customer-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onOpenCustomerModal}
          >
            {customer ? 'Change' : 'Select Customer'}
          </button>
          {customer && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClearCustomer}
              title="Switch to Walk-in"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 2. CART ITEMS LIST */}
      <div className="pos-cart-items-wrapper">
        <div className="pos-cart-table-header">
          <span className="pos-col-item">Item</span>
          <span className="pos-col-qty">Qty</span>
          <span className="pos-col-rate">Rate</span>
          <span className="pos-col-amt">Amount</span>
          <span className="pos-col-act"></span>
        </div>

        {items.length === 0 ? (
          <div className="pos-cart-empty">
            <ShoppingBag size={48} className="pos-empty-icon" />
            <p className="pos-empty-title">Cart is Empty</p>
            <p className="pos-empty-subtitle">
              Click or tap items on the left catalog to add them to this bill.
            </p>
          </div>
        ) : (
          <div className="pos-cart-lines">
            {items.map((item) => (
              <div key={item.id} className="pos-cart-line-row">
                <div className="pos-col-item">
                  <span className="pos-item-name">{item.productName}</span>
                  {item.gujaratiName && (
                    <span className="pos-item-gujarati">{item.gujaratiName}</span>
                  )}
                  {item.packName && (
                    <span className="pos-item-pack">{item.packName}</span>
                  )}
                </div>

                <div className="pos-col-qty">
                  <div className="pos-qty-stepper">
                    <button
                      type="button"
                      className="pos-stepper-btn minus"
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      className="pos-qty-input"
                      value={item.quantity}
                      min="1"
                      max="9999"
                      onChange={(e) =>
                        onSetQuantity(item.id, parseInt(e.target.value, 10) || 1)
                      }
                      aria-label={`Quantity for ${item.productName}`}
                    />
                    <button
                      type="button"
                      className="pos-stepper-btn plus"
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="pos-col-rate">
                  <span>₹{item.unitRate.toFixed(2)}</span>
                </div>

                <div className="pos-col-amt">
                  <span className="pos-line-total">₹{item.totalAmount.toFixed(2)}</span>
                </div>

                <div className="pos-col-act">
                  <button
                    type="button"
                    className="pos-remove-line-btn"
                    onClick={() => onRemoveItem(item.id)}
                    title="Remove item from bill"
                    aria-label={`Remove ${item.productName}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. TOTALS & FINANCIAL SUMMARY */}
      <div className="pos-cart-footer">
        {items.length > 0 && (
          <div className="pos-clear-cart-row">
            <button
              type="button"
              className="pos-clear-cart-link"
              onClick={onClearCart}
            >
              <Trash2 size={13} />
              <span>Clear Cart</span>
            </button>
            {isResolvingPrices && (
              <span className="pos-pricing-syncing">
                <Loader2 size={12} className="animate-spin" />
                <span>Syncing rates with server...</span>
              </span>
            )}
          </div>
        )}

        <div className="pos-totals-table">
          <div className="pos-total-row">
            <span>Subtotal</span>
            <span className="pos-num-val">{formatCurrency(subtotal)}</span>
          </div>

          {showDiscountInput ? (
            <div className="pos-total-row discount-row">
              <span className="pos-discount-label">
                Bill Discount (₹)
                <button
                  type="button"
                  className="pos-hide-discount-btn"
                  onClick={() => {
                    setShowDiscountInput(false);
                    onSetDiscountAmount(0);
                  }}
                >
                  Remove
                </button>
              </span>
              <input
                type="number"
                min="0"
                step="1"
                className="pos-discount-input"
                value={discountAmount || ''}
                placeholder="0"
                onChange={(e) => onSetDiscountAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="pos-add-discount-btn"
              onClick={() => setShowDiscountInput(true)}
            >
              + Add Discount
            </button>
          )}

          <div className="pos-grand-total-row">
            <span className="pos-grand-total-label">Grand Total</span>
            <span className="pos-grand-total-val">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* 4. PAYMENT MODE SELECTOR */}
        <div className="pos-payment-section">
          <span className="pos-section-label">Select Payment Mode:</span>
          <div className="pos-payment-mode-buttons">
            <button
              type="button"
              className={`pos-mode-btn ${paymentMode === 'CASH' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('CASH')}
            >
              <Banknote size={16} />
              <span>CASH</span>
            </button>
            <button
              type="button"
              className={`pos-mode-btn ${paymentMode === 'UPI' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('UPI')}
            >
              <QrCode size={16} />
              <span>UPI</span>
            </button>
            <button
              type="button"
              className={`pos-mode-btn ${paymentMode === 'CARD' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('CARD')}
            >
              <CreditCard size={16} />
              <span>CARD</span>
            </button>
            <button
              type="button"
              className={`pos-mode-btn ${paymentMode === 'OTHER' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('OTHER')}
            >
              <Layers size={16} />
              <span>OTHER</span>
            </button>
          </div>

          {/* CASH TENDER & CHANGE CALCULATION */}
          {paymentMode === 'CASH' ? (
            <div className="pos-cash-tender-card">
              <div className="pos-tender-input-row">
                <label className="pos-tender-label">Cash Tendered (₹):</label>
                <input
                  type="number"
                  className="pos-tender-input"
                  value={paidAmount || ''}
                  placeholder={grandTotal.toString()}
                  onChange={(e) => onSetPaidAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="pos-quick-tender-presets">
                <button
                  type="button"
                  className="pos-preset-btn"
                  onClick={() => handleQuickTender(0)}
                >
                  Exact (₹{grandTotal})
                </button>
                <button
                  type="button"
                  className="pos-preset-btn"
                  onClick={() => handleQuickTender(50)}
                >
                  +₹50
                </button>
                <button
                  type="button"
                  className="pos-preset-btn"
                  onClick={() => handleQuickTender(100)}
                >
                  +₹100
                </button>
                <button
                  type="button"
                  className="pos-preset-btn"
                  onClick={() => handleQuickTender(500)}
                >
                  +₹500
                </button>
              </div>

              {changeAmount > 0 && (
                <div className="pos-change-row">
                  <span>Change to Return:</span>
                  <strong className="pos-change-amount">{formatCurrency(changeAmount)}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="pos-non-cash-row">
              <input
                type="text"
                className="form-input pos-ref-input"
                placeholder="Transaction Ref / UTR (Optional)"
                value={transactionRef}
                onChange={(e) => onSetTransactionRef(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* 5. COMPLETE BILL ACTION BUTTON */}
        <button
          type="button"
          className="pos-complete-bill-btn"
          disabled={items.length === 0 || isSubmitting}
          onClick={onSubmitSale}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>Processing Sale Transaction...</span>
            </>
          ) : (
            <>
              <span>Complete Bill • {formatCurrency(grandTotal)}</span>
              <kbd className="pos-btn-kbd">Ctrl+↵</kbd>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
