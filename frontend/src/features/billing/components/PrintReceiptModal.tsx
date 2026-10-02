import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Loader2, Download } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Button } from '../../../components/ui/Button/Button';
import { BillingApi, ThermalPrintPayload } from '../billing.api';
import { reportsApi } from '../../reports/reports.api';
import { formatCurrency, formatDateTime, formatAmountInWords } from '../../../utils/formatters';

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
  const [wholesalePrintMode, setWholesalePrintMode] = useState<'a4' | 'thermal'>('a4');
  const [thermalWidth, setThermalWidth] = useState<'80mm' | '58mm'>('80mm');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isWholesale = payload?.invoice?.saleType === 'WHOLESALE';

  useEffect(() => {
    if (!isOpen || !saleId) {
      setPayload(null);
      setWholesalePrintMode('a4');
      setThermalWidth('80mm');
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

  // Manage body classes for dedicated print styling and isolating print portal
  useEffect(() => {
    if (isOpen && payload) {
      document.body.classList.add('pos-print-active');
      const isThermal = !isWholesale || wholesalePrintMode === 'thermal';
      if (isThermal) {
        document.body.classList.add('pos-print-thermal');
        document.body.classList.remove('pos-print-wholesale');
        if (thermalWidth === '58mm') {
          document.body.classList.add('pos-print-58mm');
        } else {
          document.body.classList.remove('pos-print-58mm');
        }
      } else {
        document.body.classList.add('pos-print-wholesale');
        document.body.classList.remove('pos-print-thermal', 'pos-print-58mm');
      }
    } else {
      document.body.classList.remove('pos-print-active', 'pos-print-wholesale', 'pos-print-thermal', 'pos-print-58mm');
    }

    return () => {
      document.body.classList.remove('pos-print-active', 'pos-print-wholesale', 'pos-print-thermal', 'pos-print-58mm');
    };
  }, [isOpen, payload, isWholesale, wholesalePrintMode, thermalWidth]);

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!saleId || !payload) return;
    setIsDownloadingPdf(true);
    try {
      await reportsApi.downloadInvoicePdf(saleId, payload.invoice.billNumber);
    } catch (err: any) {
      alert(err?.message || 'Failed to download invoice PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };


  const renderWholesaleContent = () => {
    if (!payload) return null;
    return (
      <>
        {/* 1. Header */}
        <div className="a4-header">
          <div className="a4-header-brand">
            <img src="/logo.png" alt="વહાણવટી ગૃહ ઉદ્યોગ" className="a4-brand-logo" />
            <div className="a4-brand-text">
              <h1 className="a4-company-name">{payload.company.name}</h1>
              {payload.company.tagline && (
                <p className="a4-company-tagline">{payload.company.tagline}</p>
              )}
              {payload.company.address && (
                <p className="a4-company-address">{payload.company.address}</p>
              )}
              <div className="a4-company-meta">
                {payload.company.phone && <span><strong>Phone:</strong> {payload.company.phone}</span>}
                {payload.company.gstin && <span><strong>GSTIN:</strong> {payload.company.gstin}</span>}
                {payload.company.fssaiLicense && <span><strong>FSSAI:</strong> {payload.company.fssaiLicense}</span>}
              </div>
            </div>
          </div>
          <div className="a4-header-doc">
            <div className="a4-doc-badge">WHOLESALE TAX INVOICE</div>
            <div className="a4-doc-meta-table">
              <div className="a4-meta-row">
                <span className="a4-meta-lbl">Invoice No:</span>
                <strong className="a4-meta-val a4-bill-no">{payload.invoice.billNumber}</strong>
              </div>
              <div className="a4-meta-row">
                <span className="a4-meta-lbl">Date:</span>
                <span className="a4-meta-val">{formatDateTime(payload.invoice.date)}</span>
              </div>
              <div className="a4-meta-row">
                <span className="a4-meta-lbl">Biller:</span>
                <span className="a4-meta-val">{payload.invoice.billerName}</span>
              </div>
              <div className="a4-meta-row">
                <span className="a4-meta-lbl">Sale Type:</span>
                <span className="a4-meta-val a4-saletype-pill">WHOLESALE</span>
              </div>
            </div>
          </div>
        </div>

        <div className="a4-divider"></div>

        {/* 2. Customer & Payment Details */}
        <div className="a4-parties-row">
          <div className="a4-party-card">
            <div className="a4-card-title">BILLED TO (BUYER DETAILS)</div>
            <div className="a4-card-body">
              <p className="a4-buyer-name">
                <strong>{payload.invoice.customerName || 'Counter Walk-in Customer'}</strong>
              </p>
              {payload.invoice.customerAddress && (
                <p className="a4-buyer-address">
                  {payload.invoice.customerAddress}
                  {payload.invoice.customerCity ? `, ${payload.invoice.customerCity}` : ''}
                </p>
              )}
              {payload.invoice.customerMobile && (
                <p className="a4-buyer-meta">
                  <span>Mobile:</span> +91 {payload.invoice.customerMobile}
                </p>
              )}
              {payload.invoice.customerGstin && (
                <p className="a4-buyer-meta">
                  <span>GSTIN:</span> <strong>{payload.invoice.customerGstin}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="a4-party-card">
            <div className="a4-card-title">PAYMENT & SETTLEMENT</div>
            <div className="a4-card-body">
              <p className="a4-payment-row">
                <span>Payment Mode:</span>
                <strong>{payload.payments.map((p) => p.mode).join(', ') || 'CASH'}</strong>
              </p>
              {payload.payments.map((p, idx) => (
                p.ref ? (
                  <p key={idx} className="a4-payment-row">
                    <span>Ref #{idx + 1}:</span>
                    <span>{p.ref}</span>
                  </p>
                ) : null
              ))}
              <p className="a4-payment-row">
                <span>Paid Amount:</span>
                <strong>₹{payload.totals.paid.toFixed(2)}</strong>
              </p>
              {payload.totals.change > 0 && (
                <p className="a4-payment-row">
                  <span>Change Returned:</span>
                  <span>₹{payload.totals.change.toFixed(2)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 3. Items Table (with repeating headers on multi-page print) */}
        <table className="a4-items-table">
          <thead>
            <tr>
              <th className="th-sr">#</th>
              <th className="th-desc">Description of Goods (વિગત)</th>
              <th className="th-unit">Unit</th>
              <th className="th-qty">Quantity</th>
              <th className="th-rate">Historical Rate (₹)</th>
              <th className="th-sub">Subtotal (₹)</th>
              <th className="th-disc">Discount (₹)</th>
              <th className="th-total">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((item, idx) => (
              <tr key={idx}>
                <td className="td-sr">{idx + 1}</td>
                <td className="td-desc">
                  <div className="a4-item-title">{item.name}</div>
                  {item.variant && (
                    <div className="a4-item-variant">Pack: {item.variant}</div>
                  )}
                </td>
                <td className="td-unit">{item.unit || 'Kg'}</td>
                <td className="td-qty">{item.qty}</td>
                <td className="td-rate">{(item.unitRate ?? item.rate).toFixed(2)}</td>
                <td className="td-sub">
                  {(item.subtotal ?? (item.qty * (item.unitRate ?? item.rate))).toFixed(2)}
                </td>
                <td className="td-disc">
                  {item.discount && item.discount > 0 ? `-₹${item.discount.toFixed(2)}` : '—'}
                </td>
                <td className="td-total">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 4. Summary & Footer */}
        <div className="a4-summary-row">
          <div className="a4-summary-left">
            <div className="a4-amount-in-words-box">
              <span className="a4-words-label">Amount in Words:</span>
              <p className="a4-words-text">{formatAmountInWords(payload.totals.total)}</p>
            </div>
            {payload.company.footerNotes && (
              <div className="a4-terms-box">
                <span className="a4-terms-title">Notes / Terms & Conditions:</span>
                <p className="a4-terms-text">{payload.company.footerNotes}</p>
              </div>
            )}
            <div className="a4-signature-box">
              <p className="a4-sign-company">For, <strong>{payload.company.name}</strong></p>
              <div className="a4-sign-line">Authorized Signatory</div>
            </div>
          </div>

          <div className="a4-summary-right">
            <div className="a4-calc-table">
              <div className="a4-calc-row">
                <span>Subtotal (કુલ રકમ):</span>
                <span>₹{payload.totals.subtotal.toFixed(2)}</span>
              </div>
              {payload.totals.discount > 0 && (
                <div className="a4-calc-row a4-discount">
                  <span>Discount (વળતર):</span>
                  <span>-₹{payload.totals.discount.toFixed(2)}</span>
                </div>
              )}
              {payload.totals.tax && payload.totals.tax > 0 ? (
                <div className="a4-calc-row">
                  <span>GST / Tax:</span>
                  <span>₹{payload.totals.tax.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="a4-calc-row a4-grand-total">
                <span>Final Net Total (ચૂકવવાપાત્ર રકમ):</span>
                <strong>₹{payload.totals.total.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderThermalContent = () => {
    if (!payload) return null;
    return (
      <>
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
      </>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isWholesale ? 'Wholesale Tax Invoice & Receipt' : 'Print Invoice Receipt'}
        size={isWholesale && wholesalePrintMode === 'a4' ? 'lg' : 'md'}
        footer={
          <div className="pos-print-modal-footer">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {isWholesale && (
              <Button
                variant="secondary"
                leftIcon={<Download size={16} />}
                onClick={handleDownloadPdf}
                disabled={!payload || isLoading || isDownloadingPdf}
              >
                {isDownloadingPdf ? 'Downloading...' : 'Download A4 PDF'}
              </Button>
            )}
            <Button
              variant="primary"
              leftIcon={<Printer size={16} />}
              onClick={handleTriggerPrint}
              disabled={!payload || isLoading}
            >
              {isWholesale
                ? wholesalePrintMode === 'a4'
                  ? 'Print A4 Invoice (Ctrl+P)'
                  : `Print Thermal (${thermalWidth})`
                : 'Print Receipt (Ctrl+P)'}
            </Button>
          </div>
        }
      >
        <div ref={containerRef} className={`pos-print-preview-container ${isWholesale && wholesalePrintMode === 'a4' ? 'preview-a4' : ''}`}>
          {isWholesale && (
            <div
              className="wholesale-format-selector"
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '14px',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: wholesalePrintMode === 'a4' ? '#1e40af' : '#ffffff',
                    color: wholesalePrintMode === 'a4' ? '#ffffff' : '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => setWholesalePrintMode('a4')}
                >
                  A4 Corporate Invoice
                </button>
                <button
                  type="button"
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: wholesalePrintMode === 'thermal' ? '#1e40af' : '#ffffff',
                    color: wholesalePrintMode === 'thermal' ? '#ffffff' : '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => setWholesalePrintMode('thermal')}
                >
                  Compact Thermal Slip
                </button>
              </div>

              {wholesalePrintMode === 'thermal' && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>Width:</span>
                  <button
                    type="button"
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: thermalWidth === '80mm' ? '#1e40af' : '#ffffff',
                      color: thermalWidth === '80mm' ? '#ffffff' : '#334155',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => setThermalWidth('80mm')}
                  >
                    80mm
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: thermalWidth === '58mm' ? '#1e40af' : '#ffffff',
                      color: thermalWidth === '58mm' ? '#ffffff' : '#334155',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => setThermalWidth('58mm')}
                  >
                    58mm
                  </button>
                </div>
              )}
            </div>
          )}

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
            isWholesale && wholesalePrintMode === 'a4' ? (
              <div className="pos-a4-invoice pos-screen-invoice">
                {renderWholesaleContent()}
              </div>
            ) : (
              <div className={`pos-thermal-receipt pos-screen-receipt ${thermalWidth === '58mm' ? 'thermal-58mm' : ''}`}>
                {renderThermalContent()}
              </div>
            )
          ) : null}
        </div>
      </Modal>

      {/* DEDICATED PRINT PORTAL: Attached directly to document.body, isolated from modal scroll/transforms */}
      {isOpen && payload && typeof document !== 'undefined' && createPortal(
        <div id="pos-print-root" aria-hidden="true">
          <style>{`
            @page {
              size: ${isWholesale && wholesalePrintMode === 'a4' ? 'A4 portrait' : 'portrait'};
              margin: ${isWholesale && wholesalePrintMode === 'a4' ? '8mm 10mm' : '0'};
            }
          `}</style>
          {isWholesale && wholesalePrintMode === 'a4' ? (
            <div className="pos-a4-invoice" id="pos-printable-receipt">
              {renderWholesaleContent()}
            </div>
          ) : (
            <div className={`pos-thermal-receipt ${thermalWidth === '58mm' ? 'thermal-58mm' : ''}`} id="pos-printable-receipt">
              {renderThermalContent()}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};
