import React, { useState, useEffect } from 'react';
import { Printer, X, Download, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Button } from '../../../components/ui/Button/Button';
import { BillingApi, ThermalPrintPayload } from '../billing.api';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export interface PrintReceiptModalProps {
  isOpen: boolean;
  saleId: string | null;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  isOpen,
  saleId,
  onClose,
}) => {
  const [payload, setPayload] = useState<ThermalPrintPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !saleId) {
      setPayload(null);
      return;
    }

    const loadPayload = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await BillingApi.getPrintPayload(saleId);
        setPayload(data);
      } catch (err: any) {
        setError(err.message || 'Failed to generate print receipt data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPayload();
  }, [isOpen, saleId]);

  useEffect(() => {
    if (isOpen && payload && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [isOpen, payload]);

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Invoice Receipt"
      size="md"
      footer={
        <div className="pos-print-modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            leftIcon={<Printer size={16} />}
            onClick={handleTriggerPrint}
            disabled={!payload || isLoading}
          >
            Print Receipt (Ctrl+P)
          </Button>
        </div>
      }
    >
      <div ref={containerRef} className="pos-print-preview-container">
        {isLoading ? (
          <div className="pos-print-loading">
            <Loader2 size={32} className="animate-spin" />
            <p>Loading invoice print preview...</p>
          </div>
        ) : error ? (
          <div className="pos-print-error">
            <p>{error}</p>
          </div>
        ) : payload ? (
          /* THERMAL 80MM RECEIPT PREVIEW (PRINTABLE REGION) */
          <div className="pos-thermal-receipt" id="pos-printable-receipt">
            {/* 1. Header */}
            <div className="receipt-header">
              <div className="receipt-logo-wrap">
                <img src="/logo.png" alt="વહાણવટી ગૃહ ઉદ્યોગ" className="receipt-logo" />
              </div>
              <h2 className="receipt-company-name">{payload.company.name}</h2>
              {payload.company.tagline && (
                <p className="receipt-tagline">{payload.company.tagline}</p>
              )}
              {payload.company.address && (
                <p className="receipt-meta-line">{payload.company.address}</p>
              )}
              {payload.company.phone && (
                <p className="receipt-meta-line">Phone: {payload.company.phone}</p>
              )}
              {payload.company.gstin && (
                <p className="receipt-meta-line">GSTIN: {payload.company.gstin}</p>
              )}
              {payload.company.fssaiLicense && (
                <p className="receipt-meta-line">FSSAI: {payload.company.fssaiLicense}</p>
              )}
            </div>

            <div className="receipt-divider-dashed"></div>

            {/* 2. Bill Meta (Customer type is NEVER printed) */}
            <div className="receipt-meta-block">
              <div className="receipt-row">
                <span>Bill No:</span>
                <strong>{payload.invoice.billNumber}</strong>
              </div>
              <div className="receipt-row">
                <span>Date:</span>
                <span>{formatDateTime(payload.invoice.date)}</span>
              </div>
              <div className="receipt-row">
                <span>Biller:</span>
                <span>{payload.invoice.billerName}</span>
              </div>
              {payload.invoice.customerName && (
                <div className="receipt-row">
                  <span>Customer:</span>
                  <span>{payload.invoice.customerName}</span>
                </div>
              )}
              {payload.invoice.customerMobile && (
                <div className="receipt-row">
                  <span>Mobile:</span>
                  <span>{payload.invoice.customerMobile}</span>
                </div>
              )}
            </div>

            <div className="receipt-divider-dashed"></div>

            {/* 3. Items Table */}
            <table className="receipt-items-table">
              <thead>
                <tr>
                  <th className="th-name">વિગત (Item)</th>
                  <th className="th-qty">જથ્થો (Qty)</th>
                  <th className="th-rate">ભાવ (Rate)</th>
                  <th className="th-amt">રકમ (Amt)</th>
                </tr>
              </thead>
              <tbody>
                {payload.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="td-name">
                      <span className="receipt-item-title">{item.name}</span>
                      {item.variant && (
                        <span className="receipt-item-variant">({item.variant})</span>
                      )}
                    </td>
                    <td className="td-qty">{item.qty}</td>
                    <td className="td-rate">{item.rate.toFixed(2)}</td>
                    <td className="td-amt">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-divider-dashed"></div>

            {/* 4. Totals & Payments */}
            <div className="receipt-totals-block">
              <div className="receipt-row">
                <span>Subtotal:</span>
                <span>₹{payload.totals.subtotal.toFixed(2)}</span>
              </div>
              {payload.totals.discount > 0 && (
                <div className="receipt-row">
                  <span>Discount:</span>
                  <span>-₹{payload.totals.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="receipt-row grand-total">
                <span>કુલ રકમ (NET TOTAL):</span>
                <strong>₹{payload.totals.total.toFixed(2)}</strong>
              </div>
              <div className="receipt-row">
                <span>Paid Tender:</span>
                <span>₹{payload.totals.paid.toFixed(2)}</span>
              </div>
              {payload.totals.change > 0 && (
                <div className="receipt-row">
                  <span>Change:</span>
                  <span>₹{payload.totals.change.toFixed(2)}</span>
                </div>
              )}
              {payload.payments.map((pm, pidx) => (
                <div key={pidx} className="receipt-row receipt-payment-row">
                  <span>Paid via {pm.mode}:</span>
                  <span>₹{pm.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-divider-dashed"></div>

            {/* 5. Footer Notes */}
            <div className="receipt-footer">
              <p className="receipt-thank-you">મુલાકાત બદલ આભાર! / Thank you!</p>
              {payload.company.footerNotes && (
                <p className="receipt-notes">{payload.company.footerNotes}</p>
              )}
              <p className="receipt-sign">ફોર, વહાણવટી ગૃહ ઉદ્યોગ</p>
              <p className="receipt-system-tag">Vahanvati Gruh Udhyog Management System</p>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
