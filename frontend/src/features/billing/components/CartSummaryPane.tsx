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
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { CartItem } from '../hooks/useBillingCart';
import { Customer } from '../../customers/customers.api';
import { CustomerType } from '../../../types/common.types';
import { PaymentMode, SaleType } from '../billing.api';
import { Badge } from '../../../components/ui/Badge/Badge';
import { formatCurrency } from '../../../utils/formatters';

export interface CartSummaryPaneProps {
  items: CartItem[];
  customer: Customer | null;
  customerType: CustomerType;
  saleType: SaleType;
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
  saleType,
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

  const hasUnpricedItems = items.some((it) => it.unitRate <= 0 || it.hasPriceError);

  return (
    <div className="pos-cart-content">
      {/* 1. CUSTOMER & PRICING SELECTION BAR */}
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
              <span className="pos-demographic-badge" title="Customer Demographic">
                Demographic: {customerType}
              </span>
            </div>
            <div className="pos-customer-sub-line">
              <span className="pos-saletype-badge-display">
                <Tag size={11} />
                <span>Tier: <strong>{saleType}</strong></span>
              </span>
              {customer?.mobile && (
                <span className="pos-customer-mobile-tag">+91 {customer.mobile}</span>
              )}
            </div>
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
        <div className="pos-cart-header-row">
          <span className="pos-cart-section-title">
            Items in Bill ({items.reduce((s, i) => s + i.quantity, 0)})
          </span>
          {items.length > 0 && (
            <button
              type="button"
              className="pos-clear-cart-link"
              onClick={onClearCart}
              title="Clear all items from bill"
            >
              <Trash2 size={13} />
              <span>Clear Bill</span>
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="pos-cart-empty">
            <ShoppingBag size={48} className="pos-empty-icon" />
            <p className="pos-empty-title">Cart is Empty</p>
            <p className="pos-empty-subtitle">
              Click or tap products on the left catalog to add them to this bill.
            </p>
          </div>
        ) : (
          <div className="pos-cart-cards-list">
            <div className="pos-cart-columns-header">
              <span className="pos-col-item">Item</span>
              <span className="pos-col-qty">Qty</span>
              <span className="pos-col-total">Total</span>
              <span className="pos-col-action"></span>
            </div>
            {items.map((item) => {
              const isMissingPrice = item.unitRate <= 0 || item.hasPriceError;
              return (
                <div
                  key={item.id}
                  className={`pos-cart-item-row ${isMissingPrice ? 'has-price-error' : ''}`}
                >
                  {/* Left Column: Product name, Gujarati tag, Pack / Rate subtext */}
                  <div className="pos-cart-item-info">
                    <div className="pos-cart-item-title-row">
                      <span className="pos-cart-item-name" title={item.productName}>
                        {item.productName}
                      </span>
                      {item.gujaratiName && (
                        <span className="pos-cart-item-gujarati" title={item.gujaratiName}>
                          {item.gujaratiName}
                        </span>
                      )}
                    </div>
                    <div className="pos-cart-item-subtext">
                      {item.packName && (
                        <span className="pos-cart-item-pack">{item.packName}</span>
                      )}
                      {isMissingPrice ? (
                        <span className="pos-item-unpriced-pill" title="No active price for this SaleType">
                          <AlertTriangle size={11} /> No {saleType} Rate
                        </span>
                      ) : (
                        <span className="pos-cart-item-rate">@ ₹{item.unitRate.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Center Column: Compact Quantity Stepper */}
                  <div className="pos-qty-stepper compact">
                    <button
                      type="button"
                      className="pos-stepper-btn minus"
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
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
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Right Column: Line Total */}
                  <div className="pos-cart-item-total">
                    {isMissingPrice ? (
                      <span className="text-danger font-semibold text-xs">N/A</span>
                    ) : (
                      `₹${item.totalAmount.toFixed(2)}`
                    )}
                  </div>

                  {/* Far Right Column: Delete Action */}
                  <button
                    type="button"
                    className="pos-item-delete-btn"
                    onClick={() => onRemoveItem(item.id)}
                    title="Remove item"
                    aria-label={`Remove ${item.productName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. TOTALS & FINANCIAL SUMMARY */}
      <div className="pos-cart-footer">
        {isResolvingPrices && (
          <div className="pos-clear-cart-row">
            <span className="pos-pricing-syncing">
              <Loader2 size={12} className="animate-spin" />
              <span>Resolving authoritative {saleType} rates with server...</span>
            </span>
          </div>
        )}

        <div className="pos-totals-table">
          <div className="pos-total-row">
            <span>Subtotal</span>
            <span className="pos-num-val">{formatCurrency(subtotal)}</span>
          </div>

          {showDiscountInput ? (
            <div className="pos-total-row discount-row">
              <div className="pos-discount-input-wrap">
                <span>Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  step="1"
                  className="pos-discount-field"
                  placeholder="0"
                  value={discountAmount || ''}
                  onChange={(e) => onSetDiscountAmount(Number(e.target.value))}
                />
              </div>
              <span className="pos-num-val text-success">
                -{formatCurrency(discountAmount)}
              </span>
            </div>
          ) : (
            <div className="pos-add-discount-link-row">
              <button
                type="button"
                className="pos-add-discount-btn"
                onClick={() => setShowDiscountInput(true)}
              >
                + Add Special Bill Discount
              </button>
            </div>
          )}

          <div className="pos-total-row grand-total-row">
            <span>Bill Total Amount</span>
            <span className="pos-grand-amount">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* 4. PAYMENT METHOD TOGGLE & TENDER */}
        <div className="pos-payment-block">
          <label className="pos-payment-label">Payment Mode</label>
          <div className="pos-payment-methods-grid">
            <button
              type="button"
              className={`pos-pay-mode-btn ${paymentMode === 'CASH' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('CASH')}
            >
              <Banknote size={15} />
              <span>Cash</span>
            </button>
            <button
              type="button"
              className={`pos-pay-mode-btn ${paymentMode === 'UPI' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('UPI')}
            >
              <QrCode size={15} />
              <span>UPI / QR</span>
            </button>
            <button
              type="button"
              className={`pos-pay-mode-btn ${paymentMode === 'CARD' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('CARD')}
            >
              <CreditCard size={15} />
              <span>Card</span>
            </button>
            <button
              type="button"
              className={`pos-pay-mode-btn ${paymentMode === 'OTHER' ? 'active' : ''}`}
              onClick={() => onSetPaymentMode('OTHER')}
            >
              <Layers size={15} />
              <span>Credit/Other</span>
            </button>
          </div>

          {/* Cash Tender & Quick Change Preset */}
          {paymentMode === 'CASH' ? (
            <div className="pos-cash-tender-box">
              <div className="pos-tender-input-row">
                <span className="pos-tender-label">Amount Tendered:</span>
                <div className="pos-tender-input-wrap">
                  <span className="pos-currency-prefix">₹</span>
                  <input
                    type="number"
                    className="pos-tender-input"
                    placeholder={String(grandTotal)}
                    value={paidAmount || ''}
                    onChange={(e) => onSetPaidAmount(Number(e.target.value))}
                    min={grandTotal}
                  />
                </div>
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
        {hasUnpricedItems && (
          <div className="pos-unpriced-warning">
            <AlertTriangle size={15} />
            <span>
              One or more items do not have an active <strong>{saleType}</strong> price. Remove them or configure prices to proceed.
            </span>
          </div>
        )}
        <button
          type="button"
          className="pos-complete-bill-btn"
          disabled={items.length === 0 || isSubmitting || hasUnpricedItems}
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
