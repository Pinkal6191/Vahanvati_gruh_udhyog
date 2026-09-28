import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  Receipt,
  RotateCcw,
  Percent,
  AlertTriangle,
  FileText,
  RotateCcw as ResetIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ReportNav } from './components/ReportNav';
import {
  reportsApi,
  StatutoryReportQuery,
  StatutorySalesResponse,
  StatutoryItemizedResponse,
  StatutoryReturnsResponse,
  StatutoryGstSummaryResponse,
  SaleType,
  CustomerType,
  ReportDatePeriod,
} from './reports.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import './Reports.css';

type StatutoryTab = 'sales' | 'itemized' | 'returns' | 'gst';

export const StatutoryReportPage: React.FC = () => {
  const { user } = useAuth();

  const isMasterAdmin = Boolean(user?.isMasterAdmin);
  const allowedSaleTypes: SaleType[] = isMasterAdmin
    ? ['RETAIL', 'NRI', 'WHOLESALE']
    : user?.allowedReportSaleTypes && user.allowedReportSaleTypes.length > 0
    ? user.allowedReportSaleTypes
    : ['RETAIL'];

  const [activeTab, setActiveTab] = useState<StatutoryTab>('sales');

  // Filter state
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSaleType, setSelectedSaleType] = useState<SaleType | ''>('');
  const [customerType, setCustomerType] = useState<CustomerType | ''>('');
  const [gstinOnly, setGstinOnly] = useState<boolean>(false);
  const [status, setStatus] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Data state
  const [salesData, setSalesData] = useState<StatutorySalesResponse | null>(null);
  const [itemizedData, setItemizedData] = useState<StatutoryItemizedResponse | null>(null);
  const [returnsData, setReturnsData] = useState<StatutoryReturnsResponse | null>(null);
  const [gstData, setGstData] = useState<StatutoryGstSummaryResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  /**
   * Safely build query strictly conforming to backend validation contracts.
   */
  const buildQuery = useCallback((): StatutoryReportQuery => {
    const q: StatutoryReportQuery = {};

    if (period !== 'custom') {
      q.period = period;
    } else {
      q.period = 'custom';
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        q.startDate = startDate;
      }
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        q.endDate = endDate;
      }
    }

    if (selectedSaleType && ['RETAIL', 'NRI', 'WHOLESALE'].includes(selectedSaleType)) {
      q.saleType = selectedSaleType;
    }

    if (customerType && ['INDIAN', 'NRI'].includes(customerType)) {
      q.customerType = customerType;
    }

    if (gstinOnly) {
      q.gstinOnly = true;
    }

    if (activeTab === 'sales' || activeTab === 'itemized') {
      if (status && ['ALL', 'COMPLETED', 'CANCELLED'].includes(status)) {
        q.status = status;
      }
    } else if (activeTab === 'returns') {
      // Backend ReturnStatus only accepts COMPLETED | CANCELLED | DRAFT (not 'ALL').
      // Omit status when 'ALL' to retrieve all returns.
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        q.status = status;
      }
    }
    // For GST Summary, status is not applicable and omitted.

    return q;
  }, [activeTab, period, startDate, endDate, selectedSaleType, customerType, gstinOnly, status]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const q = buildQuery();
      if (activeTab === 'sales') {
        const res = await reportsApi.getStatutorySales(q);
        setSalesData(res);
      } else if (activeTab === 'itemized') {
        const res = await reportsApi.getStatutoryItemizedSales(q);
        setItemizedData(res);
      } else if (activeTab === 'returns') {
        const res = await reportsApi.getStatutoryReturns(q);
        setReturnsData(res);
      } else if (activeTab === 'gst') {
        const res = await reportsApi.getStatutoryGstSummary(q);
        setGstData(res);
      }
    } catch (err: any) {
      const safeMessage =
        err?.message === 'Validation failed'
          ? 'Unable to load report. Please verify that the selected filters and date range are valid.'
          : err?.message || 'Unable to load report';

      setError(safeMessage);

      if (err?.details && Array.isArray(err.details) && err.details.length > 0) {
        const detailStr = err.details
          .map((d: any) => (d.field ? `${d.field}: ${d.message}` : d.message))
          .join(', ');
        setErrorDetails(detailStr);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetFilters = () => {
    setPeriod('this_month');
    setStartDate('');
    setEndDate('');
    setSelectedSaleType('');
    setCustomerType('');
    setGstinOnly(false);
    setStatus('ALL');
  };

  const handleExportCsv = async () => {
    try {
      const q = buildQuery();
      const dateTag = new Date().toISOString().slice(0, 10);
      if (activeTab === 'sales') {
        await reportsApi.downloadStatutoryCsv('/reports/statutory/sales', q, `sales-register-${dateTag}.csv`);
      } else if (activeTab === 'itemized') {
        await reportsApi.downloadStatutoryCsv('/reports/statutory/sales/itemized', q, `itemized-sales-${dateTag}.csv`);
      } else if (activeTab === 'returns') {
        await reportsApi.downloadStatutoryCsv('/reports/statutory/returns', q, `sales-returns-${dateTag}.csv`);
      } else if (activeTab === 'gst') {
        await reportsApi.downloadStatutoryCsv('/reports/statutory/gst-summary', q, `gst-summary-${dateTag}.csv`);
      }
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Error downloading CSV'}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case 'sales':
        return 'Statutory Sales Register (Bill-Level)';
      case 'itemized':
        return 'Statutory Itemized Sales Register (Line-Items)';
      case 'returns':
        return 'Statutory Sales Returns Register';
      case 'gst':
        return 'Statutory GST & Tax Summary';
      default:
        return 'Statutory Report';
    }
  };

  const hasData = () => {
    if (activeTab === 'sales') return salesData && salesData.data.length > 0;
    if (activeTab === 'itemized') return itemizedData && itemizedData.data.length > 0;
    if (activeTab === 'returns') return returnsData && returnsData.data.length > 0;
    if (activeTab === 'gst') return gstData && gstData.summary.completedBills > 0;
    return false;
  };

  return (
    <div className="report-page-container">
      <div className="no-print">
        <ReportNav />
      </div>

      {/* Print-Only Header */}
      <div className="statutory-print-header">
        <h1 className="statutory-print-title">Vahanvati Gruh Udhyog</h1>
        <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: 2 }}>{getActiveTabTitle()}</div>
        <div className="statutory-print-meta">
          Scope: {isMasterAdmin ? 'Company Total (Retail, NRI, Wholesale)' : `Restricted (${allowedSaleTypes.join(', ')})`} | Filter: {period} | Printed: {new Date().toLocaleString('en-IN')}
        </div>
      </div>

      {/* Header and Actions */}
      <div className="statutory-report-header no-print">
        <div className="statutory-header-title-area">
          <h1 className="statutory-page-title">
            Statutory &amp; Compliance Reports
          </h1>
          <p className="statutory-page-subtitle">
            Auditable sales, itemized transactions, returns and GST summaries
          </p>
        </div>
        <div className="statutory-header-actions">
          <button
            type="button"
            className="statutory-btn statutory-btn-refresh"
            onClick={loadData}
            disabled={loading}
            title="Reload Data"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="statutory-btn statutory-btn-export"
            onClick={handleExportCsv}
            disabled={loading}
            title="Export CSV"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="statutory-btn statutory-btn-print"
            onClick={handlePrint}
            disabled={loading}
            title="Print / PDF"
          >
            <Printer size={16} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Access Scope Banner */}
      <div className={`statutory-scope-banner no-print ${isMasterAdmin ? '' : 'restricted'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMasterAdmin ? (
            <>
              <ShieldCheck size={18} color="#16803c" />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  Access Scope: Master Admin · Company-wide
                </span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                  (Retail · NRI · Wholesale)
                </span>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert size={18} color="#c47a00" />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#c47a00' }}>
                  Access Scope: Restricted Scoped View
                </span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                  (Authorized SaleTypes: {allowedSaleTypes.join(', ')})
                </span>
              </div>
            </>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Data integrity: Historical transaction snapshots are authoritative
        </div>
      </div>

      {/* Segmented Tab Navigation */}
      <div className="statutory-tabs-nav no-print">
        <button
          className={`statutory-tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
          type="button"
        >
          <Receipt size={15} />
          Sales Register
        </button>
        <button
          className={`statutory-tab-btn ${activeTab === 'itemized' ? 'active' : ''}`}
          onClick={() => setActiveTab('itemized')}
          type="button"
        >
          <FileSpreadsheet size={15} />
          Itemized Sales
        </button>
        <button
          className={`statutory-tab-btn ${activeTab === 'returns' ? 'active' : ''}`}
          onClick={() => setActiveTab('returns')}
          type="button"
        >
          <RotateCcw size={15} />
          Sales Returns
        </button>
        <button
          className={`statutory-tab-btn ${activeTab === 'gst' ? 'active' : ''}`}
          onClick={() => setActiveTab('gst')}
          type="button"
        >
          <Percent size={15} />
          GST / Tax Summary
        </button>
      </div>

      {/* Filter Panel Card */}
      <div className="statutory-filter-panel no-print">
        <div className="statutory-filter-header">
          <div className="statutory-filter-title">
            <Filter size={14} color="#3f438f" />
            Report Filters
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleResetFilters}
              disabled={loading}
              style={{ height: 32, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ResetIcon size={13} />
              Reset
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={loadData}
              disabled={loading}
              style={{
                height: 32,
                fontSize: 12,
                padding: '0 12px',
                backgroundColor: '#3f438f',
                borderColor: '#3f438f',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>

        <div className="statutory-filter-grid">
          {/* Date Range */}
          <div className="statutory-field">
            <label>Date Range</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as ReportDatePeriod)}
              className="form-select"
              style={{ fontSize: 13, height: 36 }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Sale Type */}
          <div className="statutory-field">
            <label>Sale Type</label>
            <select
              value={selectedSaleType}
              onChange={(e) => setSelectedSaleType(e.target.value as SaleType | '')}
              className="form-select"
              style={{ fontSize: 13, height: 36 }}
            >
              <option value="">All Authorized ({allowedSaleTypes.join(', ')})</option>
              {allowedSaleTypes.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Type */}
          <div className="statutory-field">
            <label>Customer Type</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType | '')}
              className="form-select"
              style={{ fontSize: 13, height: 36 }}
            >
              <option value="">All Customers</option>
              <option value="INDIAN">Indian (Domestic)</option>
              <option value="NRI">NRI (Overseas)</option>
            </select>
          </div>

          {/* Status (Hidden for GST summary) */}
          {activeTab !== 'gst' ? (
            <div className="statutory-field">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALL' | 'COMPLETED' | 'CANCELLED')}
                className="form-select"
                style={{ fontSize: 13, height: 36 }}
              >
                <option value="ALL">{activeTab === 'returns' ? 'All Returns' : 'All (Completed + Cancelled)'}</option>
                <option value="COMPLETED">Completed Only</option>
                <option value="CANCELLED">Cancelled Only</option>
              </select>
            </div>
          ) : (
            <div className="statutory-field" style={{ visibility: 'hidden' }}>
              <label>Placeholder</label>
              <div style={{ height: 36 }} />
            </div>
          )}

          {/* Custom Date Inputs if Custom selected */}
          {period === 'custom' && (
            <>
              <div className="statutory-field">
                <label>From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-input"
                  style={{ fontSize: 13, height: 36 }}
                />
              </div>
              <div className="statutory-field">
                <label>To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-input"
                  style={{ fontSize: 13, height: 36 }}
                />
              </div>
            </>
          )}

          {/* B2B / GSTIN Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={gstinOnly}
                onChange={(e) => setGstinOnly(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 500, color: '#334155' }}>B2B / GSTIN Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="statutory-loading-box">
          <div className="statutory-spinner" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
              Loading statutory report…
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Validating filters and querying authoritative transaction snapshot records
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="statutory-error-box no-print">
          <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b' }}>
              Unable to load report
            </div>
            <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2 }}>
              {error}
            </div>
            {errorDetails && (
              <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4, fontFamily: 'monospace' }}>
                Details: {errorDetails}
              </div>
            )}
            <button
              className="btn btn-outline"
              onClick={loadData}
              style={{
                marginTop: 10,
                fontSize: 12,
                height: 30,
                padding: '0 12px',
                borderColor: '#fca5a5',
                color: '#991b1b',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !hasData() && (
        <div className="statutory-empty-box">
          <FileText size={36} color="#94a3b8" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>
              No transactions found
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              No transactions match the selected filters. Try adjusting your date range or filters.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleResetFilters}
            style={{ fontSize: 12, height: 32, padding: '0 14px', marginTop: 4 }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* TAB 1: SALES REGISTER (BILL-LEVEL) */}
      {!loading && !error && activeTab === 'sales' && salesData && salesData.data.length > 0 && (
        <>
          <div className="report-kpi-grid-5">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Recorded Bills</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {salesData.summary.completedBills}
                {salesData.summary.cancelledBills > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#ef4444', marginLeft: 6 }}>
                    (+{salesData.summary.cancelledBills} cancelled)
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{salesData.summary.period}</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Gross Subtotal</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {formatCurrency(salesData.summary.subtotalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Stored Item Totals</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Discounts</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706', marginTop: 4 }}>
                {formatCurrency(salesData.summary.discountAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Bill Reductions</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Taxable Turnover</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
                {formatCurrency(salesData.summary.taxableAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Subtotal − Discount</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">
                {salesData.summary.isScoped ? 'Visible Total (Scoped)' : 'Company Final Total'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                {formatCurrency(salesData.summary.finalTotalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Tax: {formatCurrency(salesData.summary.taxAmount)}
              </div>
            </div>
          </div>

          <div className="report-table-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Bill #</th>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Sale Type</th>
                    <th style={{ padding: '10px 12px' }}>Customer</th>
                    <th style={{ padding: '10px 12px' }}>Type</th>
                    <th style={{ padding: '10px 12px' }}>GSTIN</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Discount</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tax</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Final Total</th>
                    <th style={{ padding: '10px 12px' }}>Payment</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.data.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: row.saleStatus === 'CANCELLED' ? '#fef2f2' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.billNumber}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {formatDateTime(row.date)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge-${row.saleType.toLowerCase()}-statutory`}>{row.saleType}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500 }}>{row.customerName}</div>
                        {row.customerMobile && (
                          <div style={{ fontSize: 11, color: '#64748b' }}>{row.customerMobile}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{row.customerType}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.customerGstin ? (
                          <span style={{ fontWeight: 600, color: '#0369a1' }}>{row.customerGstin}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>B2C</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(row.subtotalAmount)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#d97706' }}>
                        {formatCurrency(row.discountAmount)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>
                        {formatCurrency(row.taxableAmount)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(row.taxAmount)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(row.finalTotalAmount)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div>{row.paymentModes.join(', ') || 'N/A'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{row.paymentStatus}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.saleStatus === 'COMPLETED' ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>COMPLETED</span>
                        ) : (
                          <div>
                            <span style={{ color: '#dc2626', fontWeight: 600 }}>CANCELLED</span>
                            {row.cancellationReason && (
                              <div style={{ fontSize: 11, color: '#991b1b' }}>{row.cancellationReason}</div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: ITEMIZED SALES REGISTER */}
      {!loading && !error && activeTab === 'itemized' && itemizedData && itemizedData.data.length > 0 && (
        <>
          <div className="report-kpi-grid">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Line Items</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {itemizedData.summary.completedItemsCount}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{itemizedData.summary.period}</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Quantity Sold</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {itemizedData.summary.totalQuantity}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Aggregated units</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Gross Items Value</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {formatCurrency(itemizedData.summary.totalSubtotal)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Rate × Quantity</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">
                {itemizedData.summary.isScoped ? 'Visible Total (Scoped)' : 'Company Total'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                {formatCurrency(itemizedData.summary.totalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Authoritative Snapshot</div>
            </div>
          </div>

          <div className="report-table-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Bill #</th>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Sale Type</th>
                    <th style={{ padding: '10px 12px' }}>Customer</th>
                    <th style={{ padding: '10px 12px' }}>GSTIN</th>
                    <th style={{ padding: '10px 12px' }}>Product</th>
                    <th style={{ padding: '10px 12px' }}>Packing / Unit</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itemizedData.data.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: row.saleStatus === 'CANCELLED' ? '#fef2f2' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.billNumber}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {formatDateTime(row.date)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge-${row.saleType.toLowerCase()}-statutory`}>{row.saleType}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{row.customerName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.customerGstin ? (
                          <span style={{ fontWeight: 600, color: '#0369a1' }}>{row.customerGstin}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>B2C</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.productName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {[row.weightOrPack, row.unitSymbol].filter(Boolean).join(' ')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.quantity}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(row.unitRate)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(row.subtotal)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(row.total)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: row.saleStatus === 'COMPLETED' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {row.saleStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: SALES RETURNS REGISTER */}
      {!loading && !error && activeTab === 'returns' && returnsData && returnsData.data.length > 0 && (
        <>
          <div className="report-kpi-grid">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Completed Returns</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {returnsData.summary.completedReturns}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{returnsData.summary.period}</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Returned Quantity</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {returnsData.summary.totalReturnedQuantity}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Items returned</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Refund Amount</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
                {formatCurrency(returnsData.summary.totalRefundAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Authoritative refund values</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Status Summary</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 6 }}>
                {returnsData.summary.completedReturns} Completed · {returnsData.summary.cancelledReturns} Cancelled
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Audit trail intact</div>
            </div>
          </div>

          <div className="report-table-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Return #</th>
                    <th style={{ padding: '10px 12px' }}>Original Bill</th>
                    <th style={{ padding: '10px 12px' }}>Return Date</th>
                    <th style={{ padding: '10px 12px' }}>Customer</th>
                    <th style={{ padding: '10px 12px' }}>Sale Type</th>
                    <th style={{ padding: '10px 12px' }}>Items Returned</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Refund Amount</th>
                    <th style={{ padding: '10px 12px' }}>Refund Mode</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsData.data.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.returnNumber}</td>
                      <td style={{ padding: '10px 12px' }}>{row.originalBillNumber}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {formatDateTime(row.date)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{row.customerName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge-${row.saleType.toLowerCase()}-statutory`}>{row.saleType}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.items.map((item, idx) => (
                          <div key={idx} style={{ fontSize: 12 }}>
                            {item.productName}: {item.returnedQuantity} × {formatCurrency(item.unitRate)} ({item.restockCondition})
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        {formatCurrency(row.totalReturnAmount)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{row.refundPaymentMode}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: row.status === 'COMPLETED' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 4: GST / TAX SUMMARY */}
      {!loading && !error && activeTab === 'gst' && gstData && gstData.summary.completedBills > 0 && (
        <>
          <div className="report-kpi-grid-5">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Completed Bills</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {gstData.summary.completedBills}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{gstData.summary.period}</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Gross Subtotal</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {formatCurrency(gstData.summary.grossSubtotalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Discount: {formatCurrency(gstData.summary.discountAmount)}
              </div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Taxable Turnover</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
                {formatCurrency(gstData.summary.taxableAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Subtotal − Discount</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Aggregate Tax Amount</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                {formatCurrency(gstData.summary.taxAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Stored aggregate GST</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">
                {gstData.summary.isScoped ? 'Net Visible Turnover' : 'Net Company Turnover'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                {formatCurrency(gstData.summary.netFinalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Returns Deducted: {formatCurrency(gstData.summary.returnAmount)}
              </div>
            </div>
          </div>

          {/* Section 1: By Commercial SaleType */}
          <div className="report-section-header" style={{ marginTop: 16 }}>
            <div>
              <h3 className="report-section-title" style={{ fontSize: 15, fontWeight: 600 }}>
                1. By Commercial Sale Type
              </h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                RETAIL, NRI, and WHOLESALE commercial segmentation
              </span>
            </div>
          </div>

          <div className="report-table-card" style={{ marginBottom: 24 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Sale Type</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Completed Bills</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Gross Subtotal</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Discount</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tax Amount</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Gross Sales</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Returns</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Turnover</th>
                  </tr>
                </thead>
                <tbody>
                  {(['RETAIL', 'NRI', 'WHOLESALE'] as SaleType[]).map((st) => {
                    const seg = gstData.bySaleType[st] || {
                      billsCount: 0,
                      subtotalAmount: 0,
                      discountAmount: 0,
                      taxableAmount: 0,
                      taxAmount: 0,
                      finalTotalAmount: 0,
                      returnsCount: 0,
                      returnAmount: 0,
                      netAmount: 0,
                    };
                    return (
                      <tr key={st} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          <span className={`badge-${st.toLowerCase()}-statutory`}>{st}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{seg.billsCount}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(seg.subtotalAmount)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#d97706' }}>
                          {formatCurrency(seg.discountAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>
                          {formatCurrency(seg.taxableAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(seg.taxAmount)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(seg.finalTotalAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626' }}>
                          {seg.returnsCount > 0 ? `-${formatCurrency(seg.returnAmount)}` : '₹0.00'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {formatCurrency(seg.netAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: By GST Classification */}
          <div className="report-section-header">
            <div>
              <h3 className="report-section-title" style={{ fontSize: 15, fontWeight: 600 }}>
                2. By Statutory GST Classification (B2B vs B2C)
              </h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                B2B identified by immutable customer GSTIN snapshot
              </span>
            </div>
          </div>

          <div className="report-table-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Classification</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Completed Bills</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Gross Subtotal</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Discount</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tax Amount</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Gross Sales</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Returns</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Turnover</th>
                  </tr>
                </thead>
                <tbody>
                  {(['B2B', 'B2C'] as const).map((cls) => {
                    const seg = gstData.byGstClassification[cls] || {
                      billsCount: 0,
                      subtotalAmount: 0,
                      discountAmount: 0,
                      taxableAmount: 0,
                      taxAmount: 0,
                      finalTotalAmount: 0,
                      returnsCount: 0,
                      returnAmount: 0,
                      netAmount: 0,
                    };
                    return (
                      <tr key={cls} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          <span style={{ color: cls === 'B2B' ? '#0369a1' : '#475569' }}>
                            {cls === 'B2B' ? 'B2B (Registered with GSTIN)' : 'B2C (Consumer / Unregistered)'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{seg.billsCount}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(seg.subtotalAmount)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#d97706' }}>
                          {formatCurrency(seg.discountAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>
                          {formatCurrency(seg.taxableAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(seg.taxAmount)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(seg.finalTotalAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626' }}>
                          {seg.returnsCount > 0 ? `-${formatCurrency(seg.returnAmount)}` : '₹0.00'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {formatCurrency(seg.netAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>
            * Note: Taxable Turnover is calculated strictly as Subtotal − Discount. Aggregate tax amounts reflect stored
            database values without synthesized CGST/SGST/IGST splits.
          </div>
        </>
      )}
    </div>
  );
};
