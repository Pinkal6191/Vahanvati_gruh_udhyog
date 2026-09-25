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
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSaleType, setSelectedSaleType] = useState<SaleType | ''>('');
  const [customerType, setCustomerType] = useState<CustomerType | ''>('');
  const [gstinOnly, setGstinOnly] = useState<boolean>(false);
  const [status, setStatus] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');

  const [salesData, setSalesData] = useState<StatutorySalesResponse | null>(null);
  const [itemizedData, setItemizedData] = useState<StatutoryItemizedResponse | null>(null);
  const [returnsData, setReturnsData] = useState<StatutoryReturnsResponse | null>(null);
  const [gstData, setGstData] = useState<StatutoryGstSummaryResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback((): StatutoryReportQuery => {
    const q: StatutoryReportQuery = {};
    if (period !== 'custom') {
      q.period = period;
    } else {
      if (startDate) q.startDate = startDate;
      if (endDate) q.endDate = endDate;
    }

    if (selectedSaleType) {
      q.saleType = selectedSaleType;
    }
    if (customerType) {
      q.customerType = customerType;
    }
    if (gstinOnly) {
      q.gstinOnly = true;
    }
    if (status) {
      q.status = status;
    }
    return q;
  }, [period, startDate, endDate, selectedSaleType, customerType, gstinOnly, status]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setError(err?.message || 'Failed to load statutory report data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const formatCurrency = (val: number | undefined | null) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="report-page-container">
      <div className="no-print">
        <ReportNav />
      </div>

      {/* Header and Actions */}
      <div className="report-section-header">
        <div>
          <h1 className="report-section-title">Statutory &amp; CA Compliance Reporting</h1>
          <p className="report-section-desc">
            Auditable, bill-by-bill, line-item, returns, and GST registers. Zero data manipulation.
          </p>
        </div>
        <div className="report-header-actions no-print">
          <button className="btn btn-outline" onClick={loadData} disabled={loading} title="Reload Data">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-outline" onClick={handleExportCsv} disabled={loading} title="Export CSV">
            <Download size={16} />
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={handlePrint} title="Print A4 / PDF">
            <Printer size={16} />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* RBAC Scope Indicator */}
      <div className="report-mini-list-card no-print" style={{ padding: '12px 16px', margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMasterAdmin ? (
              <>
                <ShieldCheck size={18} color="#16a34a" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
                  Unrestricted Master Admin Access
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  (Company-Wide: Retail, NRI &amp; Wholesale)
                </span>
              </>
            ) : (
              <>
                <ShieldAlert size={18} color="#d97706" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#d97706' }}>
                  Restricted Report View (Scoped)
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Visible SaleTypes: {allowedSaleTypes.join(', ')}
                </span>
              </>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Historical snapshots authoritative | Stored rates &amp; aggregate tax amounts only
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: 8, marginTop: 8 }}>
        <button
          className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('sales')}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
        >
          <Receipt size={16} />
          Sales Register (Bill-Level)
        </button>
        <button
          className={`btn ${activeTab === 'itemized' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('itemized')}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
        >
          <FileSpreadsheet size={16} />
          Itemized Sales Register
        </button>
        <button
          className={`btn ${activeTab === 'returns' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('returns')}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
        >
          <RotateCcw size={16} />
          Sales Returns Register
        </button>
        <button
          className={`btn ${activeTab === 'gst' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('gst')}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
        >
          <Percent size={16} />
          GST / Tax Summary
        </button>
      </div>

      {/* Filter Controls */}
      <div className="report-table-toolbar no-print" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
              Date Range
            </label>
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

          {period === 'custom' && (
            <>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-input"
                  style={{ fontSize: 13, height: 36 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
                  To Date
                </label>
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

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
              Sale Type
            </label>
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

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
              Customer Type
            </label>
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

          {(activeTab === 'sales' || activeTab === 'itemized') && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALL' | 'COMPLETED' | 'CANCELLED')}
                className="form-select"
                style={{ fontSize: 13, height: 36 }}
              >
                <option value="ALL">All (Completed + Cancelled)</option>
                <option value="COMPLETED">Completed Only</option>
                <option value="CANCELLED">Cancelled Only</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={gstinOnly}
                onChange={(e) => setGstinOnly(e.target.checked)}
              />
              B2B / GSTIN Only
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: 8, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* TAB 1: SALES REGISTER (BILL-LEVEL) */}
      {activeTab === 'sales' && salesData && (
        <>
          <div className="report-kpi-grid-5">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Bills</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {salesData.summary.completedBills}
                {salesData.summary.cancelledBills > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#ef4444', marginLeft: 6 }}>
                    (+{salesData.summary.cancelledBills} cancelled)
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{salesData.summary.period}</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Gross Subtotal</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(salesData.summary.subtotalAmount)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Stored Item Totals</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Discounts</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>
                {formatCurrency(salesData.summary.discountAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Bill Reductions</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Taxable Value</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0284c7' }}>
                {formatCurrency(salesData.summary.taxableAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Subtotal - Discount</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">
                {salesData.summary.isScoped ? 'Visible Total (Scoped)' : 'Company Total'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(salesData.summary.finalTotalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Tax: {formatCurrency(salesData.summary.taxAmount)}</div>
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
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '10px 12px' }}>Payment</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.data.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: row.saleStatus === 'CANCELLED' ? '#fef2f2' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.billNumber}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {new Date(row.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge badge-${row.saleType.toLowerCase()}`}>{row.saleType}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div>{row.customerName}</div>
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
                  {salesData.data.length === 0 && (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                        No bills recorded in this period for the authorized filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: ITEMIZED SALES REGISTER */}
      {activeTab === 'itemized' && itemizedData && (
        <>
          <div className="report-kpi-grid">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Line Items</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{itemizedData.summary.completedItemsCount}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{itemizedData.summary.period}</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Quantity Sold</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{itemizedData.summary.totalQuantity}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Sum of item quantities</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Gross Items Value</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(itemizedData.summary.totalSubtotal)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Rate × Quantity</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">
                {itemizedData.summary.isScoped ? 'Visible Total (Scoped)' : 'Company Total'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(itemizedData.summary.totalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Authoritative Snapshot</div>
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
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: row.saleStatus === 'CANCELLED' ? '#fef2f2' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.billNumber}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {new Date(row.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge badge-${row.saleType.toLowerCase()}`}>{row.saleType}</span>
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
                  {itemizedData.data.length === 0 && (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                        No items found matching the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: SALES RETURNS REGISTER */}
      {activeTab === 'returns' && returnsData && (
        <>
          <div className="report-kpi-grid">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Completed Returns</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{returnsData.summary.completedReturns}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{returnsData.summary.period}</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Returned Quantity</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{returnsData.summary.totalReturnedQuantity}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Items returned</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Total Refund Amount</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>
                {formatCurrency(returnsData.summary.totalRefundAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Authoritative return rates</div>
            </div>
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Status Summary</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {returnsData.summary.completedReturns} Completed / {returnsData.summary.cancelledReturns} Cancelled
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Audit trail intact</div>
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
                    <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.returnNumber}</td>
                      <td style={{ padding: '10px 12px' }}>{row.originalBillNumber}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {new Date(row.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{row.customerName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge badge-${row.saleType.toLowerCase()}`}>{row.saleType}</span>
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
                  {returnsData.data.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                        No returns recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 4: GST / TAX SUMMARY */}
      {activeTab === 'gst' && gstData && (
        <>
          <div className="report-kpi-grid-5">
            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Completed Bills</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{gstData.summary.completedBills}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{gstData.summary.period}</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Gross Subtotal</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(gstData.summary.grossSubtotalAmount)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Discount: {formatCurrency(gstData.summary.discountAmount)}</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Taxable Turnover</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0284c7' }}>
                {formatCurrency(gstData.summary.taxableAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Subtotal - Discount</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">Aggregate Tax Amount</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(gstData.summary.taxAmount)}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Stored aggregate GST</div>
            </div>

            <div className="report-mini-list-card">
              <div className="report-mini-item-sub">
                {gstData.summary.isScoped ? 'Net Visible Turnover' : 'Net Company Turnover'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(gstData.summary.netFinalAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Returns Deducted: {formatCurrency(gstData.summary.returnAmount)}
              </div>
            </div>
          </div>

          {/* Section 1: By Commercial SaleType */}
          <div className="report-section-header" style={{ marginTop: 16 }}>
            <h3 className="report-section-title">1. By Commercial Sale Type</h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              RETAIL, NRI, and WHOLESALE commercial classification
            </span>
          </div>

          <div className="report-table-card" style={{ marginBottom: 24 }}>
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
                    <tr key={st} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        <span className={`badge badge-${st.toLowerCase()}`}>{st}</span>
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

          {/* Section 2: By GST Classification */}
          <div className="report-section-header">
            <h3 className="report-section-title">2. By Statutory GST Classification (B2B vs B2C)</h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              B2B identified by immutable customer GSTIN snapshot
            </span>
          </div>

          <div className="report-table-card">
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
                    <tr key={cls} style={{ borderBottom: '1px solid #e2e8f0' }}>
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

          <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>
            * Note: Taxable Turnover is calculated strictly as Subtotal − Discount. Aggregate tax amounts reflect stored
            database values without synthesized CGST/SGST/IGST splits.
          </div>
        </>
      )}
    </div>
  );
};
