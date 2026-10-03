import React, { useState, useEffect, useRef } from 'react';
import { useBillingCart } from './hooks/useBillingCart';
import { BillingHeader } from './components/BillingHeader';
import { ProductCatalogPane, ProductCatalogPaneRef } from './components/ProductCatalogPane';
import { CartSummaryPane } from './components/CartSummaryPane';
import { CustomerSelectModal } from './components/CustomerSelectModal';
import { BillSuccessModal } from './components/BillSuccessModal';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { BillDetailsDrawer } from './components/BillDetailsDrawer';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog/ConfirmationDialog';
import { useToast } from '../../hooks/useToast';
import { SaleRecord } from './billing.api';
import { formatCurrency } from '../../utils/formatters';
import './billing.css';

export const BillingPage: React.FC = () => {
  const { addToast } = useToast();
  const catalogRef = useRef<ProductCatalogPaneRef>(null);

  const cart = useBillingCart();

  // Modals & Drawers state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printSaleId, setPrintSaleId] = useState<string | null>(null);

  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState<boolean>(false);
  const [detailsSale, setDetailsSale] = useState<SaleRecord | null>(null);

  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState<boolean>(false);

  // Mobile cart drawer toggle
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);

  // Synchronous submission lock to prevent duplicate clicks/taps/keypresses
  const isSubmittingRef = useRef<boolean>(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K -> Focus Product Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        catalogRef.current?.focusSearch();
        return;
      }

      // Ctrl/Cmd + Enter -> Complete Bill
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.items.length > 0 && !cart.isSubmitting && !isSubmittingRef.current) {
          handleCompleteSale();
        }
        return;
      }

      // F2 -> New Bill
      if (e.key === 'F2') {
        e.preventDefault();
        handleNewBill();
        return;
      }

      // Esc -> Close Modals or Drawer
      if (e.key === 'Escape') {
        if (isSuccessModalOpen) {
          handleNewBill();
        } else if (isCustomerModalOpen) {
          setIsCustomerModalOpen(false);
        } else if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
        } else if (isPrintModalOpen) {
          setIsPrintModalOpen(false);
        } else if (isDetailsDrawerOpen) {
          setIsDetailsDrawerOpen(false);
        } else if (isMobileCartOpen) {
          setIsMobileCartOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart.items.length,
    cart.isSubmitting,
    isSuccessModalOpen,
    isCustomerModalOpen,
    isShortcutsModalOpen,
    isPrintModalOpen,
    isDetailsDrawerOpen,
    isMobileCartOpen,
  ]);

  // Submit Sale Handler
  const handleCompleteSale = async () => {
    // 1. Guard against duplicate submission (double-click, double-tap, rapid key presses)
    if (isSubmittingRef.current || cart.isSubmitting) {
      return;
    }

    // 2. Validate Cart is not empty
    if (cart.items.length === 0) {
      addToast({
        title: 'Cart is Empty',
        message: 'Cart is empty. Please select products before completing the bill.',
        variant: 'warning',
      });
      return;
    }

    // 3. MANDATORY VALIDATION: Operator MUST explicitly select a payment mode
    if (!cart.paymentMode) {
      addToast({
        title: 'Payment Mode Required',
        message: 'Please select a payment mode before generating the bill.',
        variant: 'warning',
      });
      return;
    }

    isSubmittingRef.current = true;
    try {
      const sale = await cart.submitSale();
      setCompletedSale(sale);
      setIsSuccessModalOpen(true);
      setIsMobileCartOpen(false);
      addToast({
        title: 'Bill Created Successfully',
        message: `Bill #${sale.billNumber} created for ${formatCurrency(sale.finalTotalAmount)}.`,
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Billing Error',
        message: err.message || 'Could not complete sale transaction.',
        variant: 'error',
      });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Start New Bill
  const handleNewBill = () => {
    cart.clearCart();
    setIsSuccessModalOpen(false);
    setCompletedSale(null);
    catalogRef.current?.clearSearch();
    catalogRef.current?.focusSearch();
  };

  // Trigger Print Receipt
  const handleOpenPrint = (sale: SaleRecord) => {
    setPrintSaleId(sale.id);
    setIsPrintModalOpen(true);
  };

  // View Bill Details
  const handleOpenDetails = (sale: SaleRecord) => {
    setDetailsSale(sale);
    setIsDetailsDrawerOpen(true);
  };

  return (
    <div className="pos-terminal-layout">
      {/* 1. TOP HEADER */}
      <BillingHeader
        itemCount={cart.itemCount}
        customer={cart.customer}
        customerType={cart.customerType}
        saleType={cart.saleType}
        onSaleTypeChange={cart.setSaleType}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
      />

      {/* 2. TWO-PANE WORKSPACE */}
      <div className="pos-workspace-container">
        {/* LEFT: PRODUCT CATALOG */}
        <ProductCatalogPane
          ref={catalogRef}
          customerType={cart.customerType}
          saleType={cart.saleType}
          onAddToCart={cart.addToCart}
        />

        {/* RIGHT: CART SUMMARY */}
        <div className={`pos-cart-pane ${isMobileCartOpen ? 'mobile-open' : ''}`}>
          {isMobileCartOpen && (
            <div className="pos-mobile-cart-header">
              <h3>Current Bill ({cart.itemCount} items)</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsMobileCartOpen(false)}
              >
                Close ✕
              </button>
            </div>
          )}

          <CartSummaryPane
            items={cart.items}
            customer={cart.customer}
            customerType={cart.customerType}
            saleType={cart.saleType}
            subtotal={cart.subtotal}
            discountAmount={cart.discountAmount}
            grandTotal={cart.grandTotal}
            paidAmount={cart.paidAmount}
            changeAmount={cart.changeAmount}
            paymentMode={cart.paymentMode}
            transactionRef={cart.transactionRef}
            isSubmitting={cart.isSubmitting}
            isResolvingPrices={cart.isResolvingPrices}
            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
            onClearCustomer={() => cart.setCustomer(null)}
            onUpdateQuantity={cart.updateItemQuantity}
            onSetQuantity={cart.setItemQuantity}
            onRemoveItem={cart.removeItem}
            onClearCart={() => setIsClearCartConfirmOpen(true)}
            onSetDiscountAmount={cart.setDiscountAmount}
            onSetPaidAmount={cart.setPaidAmount}
            onSetPaymentMode={cart.setPaymentMode}
            onSetTransactionRef={cart.setTransactionRef}
            onSubmitSale={handleCompleteSale}
          />
        </div>
      </div>

      {/* 3. MOBILE STICKY BOTTOM CART SUMMARY */}
      {cart.items.length > 0 && !isMobileCartOpen && (
        <div className="pos-mobile-cart-bar">
          <div className="pos-mobile-cart-info">
            <span className="pos-mobile-cart-badge">
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} in bill
            </span>
            <span className="pos-mobile-cart-total">{formatCurrency(cart.grandTotal)}</span>
          </div>

          <button
            type="button"
            className="pos-mobile-view-cart-btn"
            onClick={() => setIsMobileCartOpen(true)}
          >
            Review & Pay →
          </button>
        </div>
      )}

      {/* 4. MODALS & DRAWERS */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={cart.setCustomer}
        currentCustomer={cart.customer}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <BillSuccessModal
        isOpen={isSuccessModalOpen}
        sale={completedSale}
        onPrint={handleOpenPrint}
        onNewBill={handleNewBill}
        onViewDetails={handleOpenDetails}
      />

      <PrintReceiptModal
        isOpen={isPrintModalOpen}
        saleId={printSaleId}
        onClose={() => setIsPrintModalOpen(false)}
      />

      <BillDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        sale={detailsSale}
        onClose={() => setIsDetailsDrawerOpen(false)}
        onReprint={handleOpenPrint}
      />

      <ConfirmationDialog
        isOpen={isClearCartConfirmOpen}
        onClose={() => setIsClearCartConfirmOpen(false)}
        onConfirm={() => {
          cart.clearCart();
          setIsClearCartConfirmOpen(false);
          addToast({ message: 'Cart cleared', variant: 'info' });
        }}
        title="Clear Current Cart?"
        message="Are you sure you want to remove all items from this bill?"
        confirmText="Clear Cart"
        variant="danger"
      />
    </div>
  );
};
