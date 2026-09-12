import React, { useState, useEffect } from 'react';
import { Printer, Calendar, User, XCircle, Receipt, Loader2, Package } from 'lucide-react';
import { Drawer } from '../../../components/ui/Drawer/Drawer';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { BillingApi, SaleRecord } from '../billing.api';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export interface BillDetailsDrawerProps {
  isOpen: boolean;
  sale: SaleRecord | null;
  onClose: () => void;
  onReprint: (sale: SaleRecord) => void;
}

export const BillDetailsDrawer: React.FC<BillDetailsDrawerProps> = ({
  isOpen,
  sale,
  onClose,
  onReprint,
}) => {
  const [activeSale, setActiveSale] = useState<SaleRecord | null>(sale);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    setActiveSale(sale);
    if (isOpen && sale?.id && (!sale.items || sale.items.length === 0)) {
      setIsLoadingDetails(true);
      BillingApi.getSaleById(sale.id)
        .then((full) => {
          if (full) setActiveSale(full);
        })
        .catch((err) => {
          console.error('Failed to load full sale details:', err);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [isOpen, sale]);

  if (!sale) return null;

  const current = activeSale || sale;
  const isCancelled = current.saleStatus === 'CANCELLED';
  const items = current.items || [];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Receipt size={18} style={{ color: 'var(--color-primary-700)', flexShrink: 0 }} />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Bill Details:{' '}
            <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary-800)' }}>
              {current.billNumber}
            </strong>
          </span>
        </div>
      }
      size="lg"
      position="right"
      footer={
        <div className="pos-drawer-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            leftIcon={<Printer size={16} />}
            onClick={() => onReprint(current)}
          >
            Reprint Receipt
          </Button>
        </div>
      }
    >
      <div className="pos-bill-details-content">
        {/* Status Header */}
        <div className="pos-bill-status-banner">
          <div className="pos-status-left">
            <Badge variant={isCancelled ? 'danger' : 'success'} size="md">
              {current.saleStatus}
            </Badge>
            <span className="pos-bill-date">
              <Calendar size={14} />
              {formatDateTime(current.createdAt)}
            </span>
          </div>
          <div className="pos-biller-meta">
            <User size={14} />
            <span>Billed by: {current.user?.fullName || current.user?.username || 'Staff'}</span>
          </div>
        </div>

        {/* Cancellation Notice */}
        {isCancelled && (
          <div className="pos-cancellation-alert">
            <XCircle size={18} className="text-danger" />
            <div>
              <strong>Bill Cancelled on {formatDateTime(current.cancelledAt || '')}</strong>
              <p>Reason: {current.cancellationReason || 'No reason provided'}</p>
            </div>
          </div>
        )}

        {/* Customer Information */}
        <div className="pos-drawer-section">
          <h4 className="pos-section-title">Customer Information</h4>
          <div className="pos-drawer-grid">
            <div>
              <span className="pos-meta-label">Customer Name</span>
              <p className="pos-meta-value">{current.customerNameSnapshot || 'Walk-in Customer'}</p>
            </div>
            <div>
              <span className="pos-meta-label">Mobile Number</span>
              <p className="pos-meta-value">{current.customerMobileSnapshot || '—'}</p>
            </div>
            <div>
              <span className="pos-meta-label">Customer Type</span>
              <p className="pos-meta-value">
                <Badge
                  variant={current.customerTypeSnapshot === 'NRI' ? 'warning' : 'brand'}
                  size="sm"
                >
                  {current.customerTypeSnapshot}
                </Badge>
              </p>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="pos-drawer-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 className="pos-section-title">Purchased Items ({items.length})</h4>
            {isLoadingDetails && (
              <span style={{ fontSize: '11px', color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Loader2 size={12} className="animate-spin" />
                Loading line items...
              </span>
            )}
          </div>

          {items.length > 0 ? (
            <table className="pos-drawer-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Pack / Weight</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Rate (Historical)</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong className="pos-drawer-item-name">{item.productNameSnapshot}</strong>
                    </td>
                    <td className="pos-drawer-item-pack">{item.weightOrPackSnapshot || 'Standard'}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">₹{Number(item.unitRate).toFixed(2)}</td>
                    <td className="text-right">₹{Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !isLoadingDetails ? (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-gray-200)',
              color: 'var(--color-gray-500)',
              fontSize: '12px'
            }}>
              No line items recorded for this bill.
            </div>
          ) : null}
        </div>

        {/* Financial Breakdown */}
        <div className="pos-drawer-section">
          <h4 className="pos-section-title">Financial Summary</h4>
          <div className="pos-financials-card">
            <div className="pos-fin-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(current.subtotalAmount)}</span>
            </div>
            {Number(current.discountAmount) > 0 && (
              <div className="pos-fin-row">
                <span>Discount:</span>
                <span>-{formatCurrency(current.discountAmount)}</span>
              </div>
            )}
            <div className="pos-fin-row grand-total">
              <strong>Grand Total:</strong>
              <strong className="pos-grand-text">{formatCurrency(current.finalTotalAmount)}</strong>
            </div>
            <div className="pos-fin-row">
              <span>Paid Amount:</span>
              <span>{formatCurrency(current.paidAmount)}</span>
            </div>
            {Number(current.changeReturned) > 0 && (
              <div className="pos-fin-row">
                <span>Change Returned:</span>
                <span className="text-success">{formatCurrency(current.changeReturned)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments Table */}
        <div className="pos-drawer-section">
          <h4 className="pos-section-title">Payment Breakdown</h4>
          <div className="pos-payments-list">
            {current.payments?.map((pm) => (
              <div key={pm.id} className="pos-payment-item">
                <span className="pos-payment-mode">{pm.paymentMode}</span>
                {pm.transactionReference && (
                  <span className="pos-payment-ref">Ref: {pm.transactionReference}</span>
                )}
                <strong className="pos-payment-amt">{formatCurrency(pm.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
