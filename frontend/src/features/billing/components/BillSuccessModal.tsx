import React from 'react';
import { CheckCircle2, Printer, PlusCircle, ArrowRight } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Button } from '../../../components/ui/Button/Button';
import { SaleRecord } from '../billing.api';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export interface BillSuccessModalProps {
  isOpen: boolean;
  sale: SaleRecord | null;
  onPrint: (sale: SaleRecord) => void;
  onNewBill: () => void;
  onViewDetails?: (sale: SaleRecord) => void;
}

export const BillSuccessModal: React.FC<BillSuccessModalProps> = ({
  isOpen,
  sale,
  onPrint,
  onNewBill,
  onViewDetails,
}) => {
  if (!sale) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onNewBill}
      title="Bill Completed Successfully"
      size="md"
      footer={
        <div className="pos-success-footer">
          <Button
            variant="outline"
            leftIcon={<Printer size={16} />}
            onClick={() => onPrint(sale)}
          >
            Print Receipt (P)
          </Button>

          <Button
            variant="primary"
            leftIcon={<PlusCircle size={16} />}
            onClick={onNewBill}
            autoFocus
          >
            Start New Bill (Esc)
          </Button>
        </div>
      }
    >
      <div className="pos-success-modal-content">
        <div className="pos-success-badge-icon">
          <CheckCircle2 size={54} className="text-success" />
        </div>

        <h3 className="pos-success-bill-number">{sale.billNumber}</h3>
        <p className="pos-success-timestamp">
          Recorded on {formatDateTime(sale.createdAt)}
        </p>

        <div className="pos-success-summary-grid">
          <div className="pos-success-metric-card">
            <span className="pos-success-metric-label">Grand Total</span>
            <strong className="pos-success-metric-val primary">
              {formatCurrency(sale.finalTotalAmount)}
            </strong>
          </div>

          <div className="pos-success-metric-card">
            <span className="pos-success-metric-label">Payment Mode</span>
            <strong className="pos-success-metric-val">
              {sale.payments?.[0]?.paymentMode || 'CASH'}
            </strong>
          </div>

          <div className="pos-success-metric-card">
            <span className="pos-success-metric-label">Paid Amount</span>
            <strong className="pos-success-metric-val">
              {formatCurrency(sale.paidAmount)}
            </strong>
          </div>

          <div className="pos-success-metric-card">
            <span className="pos-success-metric-label">Change Returned</span>
            <strong className="pos-success-metric-val success">
              {formatCurrency(sale.changeReturned)}
            </strong>
          </div>
        </div>

        <div className="pos-success-customer-note">
          <span>Customer: </span>
          <strong>{sale.customerNameSnapshot || 'Counter Walk-in Customer'}</strong>
          {sale.customerMobileSnapshot && <span> ({sale.customerMobileSnapshot})</span>}
        </div>

        {onViewDetails && (
          <button
            type="button"
            className="pos-success-view-details-link"
            onClick={() => onViewDetails(sale)}
          >
            <span>View Full Bill Line Items</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </Modal>
  );
};
