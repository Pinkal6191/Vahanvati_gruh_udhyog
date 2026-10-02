import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Button } from '../../../components/ui/Button/Button';
import { SalesReportData, SaleType } from '../reports.api';
import { formatCurrency, formatWeight, formatDateTime } from '../../../utils/formatters';
import { useAuth } from '../../../hooks/useAuth';
import './DailySalesPrintModal.css';

export interface DailySalesPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesData: SalesReportData | null;
  saleTypeScope?: SaleType;
}

export const DailySalesPrintModal: React.FC<DailySalesPrintModalProps> = ({
  isOpen,
  onClose,
  salesData,
  saleTypeScope,
}) => {
  const { user } = useAuth();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && salesData) {
      document.body.classList.add('daily-sales-print-active');
      if (paperWidth === '58mm') {
        document.body.classList.add('daily-sales-print-58mm');
      } else {
        document.body.classList.remove('daily-sales-print-58mm');
      }
    } else {
      document.body.classList.remove('daily-sales-print-active', 'daily-sales-print-58mm');
    }

    return () => {
      document.body.classList.remove('daily-sales-print-active', 'daily-sales-print-58mm');
    };
  }, [isOpen, salesData, paperWidth]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !salesData) return null;

  const { summary, salesByType, paymentBreakdown, timeSeries } = salesData;

  const renderContent = () => (
    <div className={`daily-thermal-content ${paperWidth === '58mm' ? 'thermal-58mm' : 'thermal-80mm'}`}>
      {/* 1. Header */}
      <div className="daily-thermal-header">
        <h2 className="daily-company-title">VAHANVATI GRUH UDHYOG</h2>
        <p className="daily-company-subtitle">વહાણવટી ગૃહ ઉદ્યોગ</p>
        <div className="daily-doc-badge">DAILY SALES SUMMARY</div>
        <div className="daily-meta-line">
          <span>Period:</span>
          <strong>{summary.period}</strong>
        </div>
        <div className="daily-meta-line">
          <span>Scope:</span>
          <span>{saleTypeScope ? `${saleTypeScope} ONLY` : 'ALL PERMITTED TIERS'}</span>
        </div>
        <div className="daily-meta-line">
          <span>Printed:</span>
          <span>{formatDateTime(new Date().toISOString())}</span>
        </div>
        <div className="daily-meta-line">
          <span>User:</span>
          <span>{user?.fullName || user?.username || 'Staff'}</span>
        </div>
      </div>

      <div className="daily-divider-dashed"></div>

      {/* 2. Key Metrics */}
      <div className="daily-section-title">FINANCIAL SUMMARY</div>
      <div className="daily-data-table">
        <div className="daily-data-row highlight-net">
          <span>TOTAL TURNOVER:</span>
          <strong>{formatCurrency(summary.totalSalesAmount)}</strong>
        </div>
        <div className="daily-data-row">
          <span>Completed Bills:</span>
          <strong>{summary.completedBillsCount}</strong>
        </div>
        <div className="daily-data-row">
          <span>Average Bill Value:</span>
          <span>{formatCurrency(summary.averageBillValue)}</span>
        </div>
        <div className="daily-data-row">
          <span>Quantity Sold:</span>
          <span>{summary.totalQuantitySold} Units</span>
        </div>
        {summary.totalWeightSold > 0 && (
          <div className="daily-data-row">
            <span>Total Weight Sold:</span>
            <span>{formatWeight(summary.totalWeightSold)}</span>
          </div>
        )}
        {summary.cancelledBillsCount > 0 && (
          <div className="daily-data-row daily-text-muted">
            <span>Cancelled Bills:</span>
            <span>{summary.cancelledBillsCount} ({formatCurrency(summary.cancelledAmount)})</span>
          </div>
        )}
      </div>

      {/* 3. Sales By Tier / Type */}
      {salesByType && Object.keys(salesByType).length > 0 && (
        <>
          <div className="daily-divider-dashed"></div>
          <div className="daily-section-title">SALES BY TIER</div>
          <div className="daily-data-table">
            {Object.entries(salesByType).map(([type, d]) => (
              <div key={type} className="daily-data-row">
                <span>{type} ({d.completedBillsCount} bills):</span>
                <span>{formatCurrency(d.totalSalesAmount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 4. Payment Modes Breakdown */}
      {paymentBreakdown && Object.keys(paymentBreakdown).length > 0 && (
        <>
          <div className="daily-divider-dashed"></div>
          <div className="daily-section-title">PAYMENT COLLECTION</div>
          <div className="daily-data-table">
            {Object.entries(paymentBreakdown).map(([mode, amt]) => (
              <div key={mode} className="daily-data-row">
                <span>{mode}:</span>
                <strong>{formatCurrency(amt)}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 5. Period Activity (if multi-day or hourly) */}
      {timeSeries && timeSeries.length > 1 && (
        <>
          <div className="daily-divider-dashed"></div>
          <div className="daily-section-title">ACTIVITY BREAKDOWN</div>
          <div className="daily-data-table">
            {timeSeries.slice(0, 10).map((ts) => (
              <div key={ts.periodKey} className="daily-data-row">
                <span>{ts.periodKey} ({ts.billsCount}):</span>
                <span>{formatCurrency(ts.salesAmount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="daily-divider-dashed"></div>

      {/* 6. Footer */}
      <div className="daily-thermal-footer">
        <p className="daily-footer-note">End of Sales Report</p>
        <p className="daily-system-tag">Vahanvati Gruh Udhyog BMS</p>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Print Daily Sales Summary (Thermal)"
        size="md"
        footer={
          <div className="daily-print-modal-footer">
            <div className="daily-width-toggle">
              <span className="daily-width-label">Paper Width:</span>
              <button
                type="button"
                className={`daily-toggle-btn ${paperWidth === '80mm' ? 'active' : ''}`}
                onClick={() => setPaperWidth('80mm')}
              >
                80mm (3-inch)
              </button>
              <button
                type="button"
                className={`daily-toggle-btn ${paperWidth === '58mm' ? 'active' : ''}`}
                onClick={() => setPaperWidth('58mm')}
              >
                58mm (2-inch)
              </button>
            </div>
            <div className="daily-footer-actions">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" leftIcon={<Printer size={16} />} onClick={handlePrint}>
                Print (Ctrl+P)
              </Button>
            </div>
          </div>
        }
      >
        <div ref={containerRef} className="daily-thermal-preview-wrap">
          <div className="daily-preview-paper">{renderContent()}</div>
        </div>
      </Modal>

      {/* DEDICATED PRINT PORTAL */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div id="daily-sales-print-root" aria-hidden="true">
          <style>{`
            @page {
              size: portrait;
              margin: 0;
            }
          `}</style>
          {renderContent()}
        </div>,
        document.body
      )}
    </>
  );
};
