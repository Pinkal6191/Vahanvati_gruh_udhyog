import React from 'react';
import { Printer, Calendar, User, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Drawer } from '../../../components/ui/Drawer/Drawer';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { SaleRecord } from '../billing.api';
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
  if (!sale) return null;

  const isCancelled = sale.saleStatus === 'CANCELLED';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Bill Details: ${sale.billNumber}`}
      size="lg"
      position="right"
    >
      <div className="pos-bill-details-content">
        {/* Status Header */}
        <div className="pos-bill-status-banner">
          <div className="pos-status-left">
            <Badge
              variant={isCancelled ? 'danger' : 'success'}
              size="md"
            >
              {sale.saleStatus}
            </Badge>
            <span className="pos-bill-date">
              <Calendar size={14} />
              {formatDateTime(sale.createdAt)}
            </span>
          </div>
          <div className="pos-biller-meta">
            <User size={14} />
            <span>Billed by: {sale.user?.fullName || sale.user?.username}</span>
          </div>
        </div>

        {/* Cancellation Notice */}
        {isCancelled && (
          <div className="pos-cancellation-alert">
            <XCircle size={18} className="text-danger" />
            <div>
              <strong>Bill Cancelled on {formatDateTime(sale.cancelledAt || '')}</strong>
              <p>Reason: {sale.cancellationReason || 'No reason provided'}</p>
            </div>
          </div>
        )}

        {/* Customer Information */}
        <div className="pos-drawer-section">
          <h4 className="pos-section-title">Customer Information</h4>
          <div className="pos-drawer-grid">
            <div>
              <span className="pos-meta-label">Customer Name</span>
              <p className="pos-meta-value">{sale.customerNameSnapshot || 'Walk-in Customer'}</p>
            </div>
            <div>
              <span className="pos-meta-label">Mobile Number</span>
              <p className="pos-meta-value">{sale.customerMobileSnapshot || '—'}</p>
            </div>
            <div>
              <span className="pos-meta-label">Customer Type</span>
              <p className="pos-meta-value">
                <Badge variant={sale.customerTypeSnapshot === 'NRI' ? 'warning' : 'brand'} size="sm">
                  {sale.customerTypeSnapshot}
                </Badge>
              </p>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="pos-drawer-section">
          <h4 className="pos-section-title">Purchased Items ({sale.items?.length || 0})</h4>
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
              {sale.items?.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.productNameSnapshot}</strong>
                  </td>
                  <td>{item.weightOrPackSnapshot || 'Standard'}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">₹{item.unitRate.toFixed(2)}</td>
                  <td className="text-right">₹{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Breakdown */}
        <div className="pos-drawer-section">
          <h4 className="pos-section-title">Financial Summary</h4>
          <div className="pos-financials-card">
            <div className="pos-fin-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(sale.subtotalAmount)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="pos-fin-row">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            <div className="pos-fin-row grand-total">
              <strong>Grand Total:</strong>
              <strong className="pos-grand-text">{formatCurrency(sale.finalTotalAmount)}</strong>
            </div>
            <div className="pos-fin-row">
              <span>Paid Amount:</span>
              <span>{formatCurrency(sale.paidAmount)}</span>
            </div>
            {sale.changeReturned > 0 && (
              <div className="pos-fin-row">
                <span>Change Returned:</span>
                <span className="text-success">{formatCurrency(sale.changeReturned)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments Table */}
        <div className="pos-drawer-section">
          <h4 className="pos-section-title">Payment Breakdown</h4>
          <div className="pos-payments-list">
            {sale.payments?.map((pm) => (
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

        {/* Footer Actions */}
        <div className="pos-drawer-footer" style={{ marginTop: '16px' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            leftIcon={<Printer size={16} />}
            onClick={() => onReprint(sale)}
          >
            Reprint Receipt
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
