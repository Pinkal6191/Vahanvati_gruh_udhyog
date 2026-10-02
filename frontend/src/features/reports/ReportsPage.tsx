import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Receipt,
  RotateCcw,
  Boxes,
  ChefHat,
  Wallet,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { PaymentBreakdownBar } from './components/ReportCharts';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { ReportExportToolbar } from './components/ReportExportToolbar';
import { useAuth } from '../../hooks/useAuth';
import { hasRole } from '../../utils/rbac';
import {
  reportsApi,
  BusinessSummaryResponse,
  ReportDatePeriod,
} from './reports.api';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import './Reports.css';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  const [summary, setSummary] = useState<BusinessSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (format === 'xlsx') setIsExportingExcel(true);
    if (format === 'pdf') setIsExportingPdf(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await reportsApi.downloadReportFile(
        '/reports/business-summary',
        { period, startDate, endDate },
        format,
        `business-summary-${dateStr}.${format}`
      );
    } catch (err: any) {
      alert(err?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setIsExportingExcel(false);
      setIsExportingPdf(false);
    }
  };

  const isAdmin = hasRole(user, ['ADMIN']);
  const isOutlet = hasRole(user, ['OUTLET']);
  const isProduction = hasRole(user, ['PRODUCTION']);

  // Role redirection if not Admin
  useEffect(() => {
    if (!isAdmin) {
      if (isOutlet) {
        navigate('/reports/sales', { replace: true });
      } else if (isProduction) {
        navigate('/reports/production', { replace: true });
      }
    }
  }, [isAdmin, isOutlet, isProduction, navigate]);

  const fetchSummary = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getBusinessSummary({
        period,
        startDate,
        endDate,
      });
      setSummary(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load executive business summary.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [period, startDate, endDate]);

  const handleFilterChange = (filters: {
    period?: ReportDatePeriod;
    startDate?: string;
    endDate?: string;
  }) => {
    if (filters.period) setPeriod(filters.period);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
  };

  if (!isAdmin) {
    return (
      <div className="report-page-container">
        <ReportNav />
        <Card>
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <ShieldAlert size={40} color="#c47a00" style={{ margin: '0 auto 12px' }} />
            <h3>Redirecting to your authorized reports...</h3>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Overview' },
        ]}
        title="Reports & Analytics"
        subtitle="Authoritative executive overview: Consolidated sales, returns, production yields, inventory health, and cash flow."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <ReportDateFilter
              period={period}
              startDate={startDate}
              endDate={endDate}
              onFilterChange={handleFilterChange}
              isLoading={isLoading}
            />
            <ReportExportToolbar
              onRefresh={fetchSummary}
              onExportExcel={() => handleExport('xlsx')}
              onExportPdf={() => handleExport('pdf')}
              isLoading={isLoading}
              isExportingExcel={isExportingExcel}
              isExportingPdf={isExportingPdf}
              disabled={isLoading || !summary}
            />
          </div>
        }
      />

      <ReportNav />

      {error ? (
        <ErrorState
          title="Error Loading Business Summary"
          message={error}
          onRetry={fetchSummary}
        />
      ) : (
        <>
          {/* Executive KPI Grid */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Net Sales"
              value={summary ? formatCurrency(summary.netSales) : '₹0.00'}
              subtitle="Completed Sales − Returns"
              badge={{ text: summary?.period || 'Period', variant: 'success' }}
              icon={<TrendingUp size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title={summary?.scope?.isScoped ? 'Authorized Sales (Scoped)' : 'Company Total Sales'}
              value={summary ? formatCurrency(summary.sales.totalSales) : '₹0.00'}
              subtitle={
                summary
                  ? `${summary.sales.billCount} bills | ABV: ${formatCurrency(summary.sales.averageBillValue)}`
                  : '0 bills recorded'
              }
              badge={
                summary?.scope?.isScoped
                  ? { text: 'Scoped', variant: 'warning' }
                  : { text: 'Company Total', variant: 'neutral' }
              }
              icon={<Receipt size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Completed Returns"
              value={summary ? formatCurrency(summary.returns.totalReturnsAmount) : '₹0.00'}
              subtitle={
                summary
                  ? `${summary.returns.returnsCount} returns processed`
                  : '0 returns recorded'
              }
              badge={{ text: 'Refunded', variant: 'warning' }}
              icon={<RotateCcw size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Production Output"
              value={summary ? formatWeight(summary.production.totalProductionWeight) : '0 GM'}
              subtitle={
                summary
                  ? `${summary.production.productionEntriesCount} completed batches`
                  : '0 batches'
              }
              icon={<ChefHat size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* SaleType Segmentation Breakdown */}
          {summary?.salesByType && (
            <div className="report-info-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 className="report-info-card-title" style={{ margin: 0 }}>
                  {summary.scope?.scopeLabel || (user?.isMasterAdmin ? 'Company Total Sales by Tier' : 'Authorized Sales by Tier')}
                </h4>
                {summary.scope?.isScoped && (
                  <span style={{ fontSize: '11.5px', color: '#c47a00', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Scoped Access
                  </span>
                )}
              </div>
              <div className="report-saletype-summary-grid">
                <div className="report-saletype-summary-card">
                  <span className="report-saletype-summary-label">Retail Sales</span>
                  <span className="report-saletype-summary-val">
                    {formatCurrency(summary.salesByType.RETAIL?.totalSales || 0)}
                  </span>
                  <span className="report-saletype-summary-sub">
                    {summary.salesByType.RETAIL?.billCount || 0} completed bills
                  </span>
                </div>

                <div className="report-saletype-summary-card">
                  <span className="report-saletype-summary-label">NRI Sales</span>
                  <span className="report-saletype-summary-val">
                    {formatCurrency(summary.salesByType.NRI?.totalSales || 0)}
                  </span>
                  <span className="report-saletype-summary-sub">
                    {summary.salesByType.NRI?.billCount || 0} completed bills
                  </span>
                </div>

                <div className="report-saletype-summary-card">
                  <span className="report-saletype-summary-label">Wholesale Sales</span>
                  <span className="report-saletype-summary-val">
                    {formatCurrency(summary.salesByType.WHOLESALE?.totalSales || 0)}
                  </span>
                  <span className="report-saletype-summary-sub">
                    {summary.salesByType.WHOLESALE?.billCount || 0} completed bills
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Secondary Operational Indicators */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Average Bill Value"
              value={summary ? formatCurrency(summary.sales.averageBillValue) : '₹0.00'}
              subtitle="Per completed customer bill"
              icon={<Wallet size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Stock Health"
              value={
                summary
                  ? `${summary.inventory.inStockCount} / ${summary.inventory.totalItems}`
                  : '0 / 0'
              }
              subtitle={
                summary
                  ? `${summary.inventory.lowStockCount} Low | ${summary.inventory.outOfStockCount} Out of Stock`
                  : 'Catalog stock items'
              }
              badge={
                summary && summary.inventory.outOfStockCount > 0
                  ? { text: `${summary.inventory.outOfStockCount} Stockout`, variant: 'danger' }
                  : { text: 'Healthy', variant: 'neutral' }
              }
              icon={<Boxes size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Cash & UPI Tendered"
              value={
                summary
                  ? formatCurrency(
                      (summary.paymentSummary.CASH || 0) + (summary.paymentSummary.UPI || 0)
                    )
                  : '₹0.00'
              }
              subtitle="Liquid payment receipts"
              icon={<Wallet size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Card & Other"
              value={
                summary
                  ? formatCurrency(
                      (summary.paymentSummary.CARD || 0) + (summary.paymentSummary.OTHER || 0)
                    )
                  : '₹0.00'
              }
              subtitle="Electronic & other tenders"
              icon={<Receipt size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* Charts & Breakdown Row */}
          <div className="report-two-col">
            {/* Payment Mode Distribution */}
            <PaymentBreakdownBar
              breakdown={summary?.paymentSummary || {}}
              title="Payment Breakdown (Authoritative Receipts)"
            />

            {/* Top 5 Products */}
            <div className="report-mini-list-card">
              <div className="report-section-header">
                <div>
                  <h4 className="report-section-title">Top 5 Products</h4>
                  <span className="report-section-desc">By Sales Revenue</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/reports/products')}
                  rightIcon={<ArrowRight size={14} />}
                >
                  View All
                </Button>
              </div>

              <div className="report-mini-list">
                {summary?.topProducts && summary.topProducts.length > 0 ? (
                  summary.topProducts.map((p, idx) => (
                    <div key={p.productId} className="report-mini-item">
                      <div className="report-mini-item-left">
                        <span className="report-mini-rank">{idx + 1}</span>
                        <div>
                          <div className="report-mini-item-name">{p.productName}</div>
                          <div className="report-mini-item-sub">
                            Qty Sold: {p.quantity}
                          </div>
                        </div>
                      </div>
                      <div className="report-mini-item-right">
                        <div className="report-mini-item-val">
                          {formatCurrency(p.revenue)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <ReportEmptyState
                    title="No top products yet"
                    description="Leading products by revenue will appear once sales are recorded."
                    minHeight={150}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quick Access to Detailed Reports */}
          <div className="report-section-header">
            <h3 className="report-section-title">Detailed Reports Directory</h3>
          </div>

          <div className="report-kpi-grid">
            <Card
              className="report-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/reports/sales')}
            >
              <div className="report-kpi-top">
                <span className="report-kpi-title">Sales Performance</span>
                <div className="report-kpi-icon-wrapper">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="report-kpi-value" style={{ fontSize: '18px' }}>
                Sales & Invoices
              </div>
              <p className="report-kpi-subtitle">
                Time-series sales, bill counts, ABV, and date breakdowns.
              </p>
            </Card>

            <Card
              className="report-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/reports/products')}
            >
              <div className="report-kpi-top">
                <span className="report-kpi-title">Product Analytics</span>
                <div className="report-kpi-icon-wrapper">
                  <Boxes size={16} />
                </div>
              </div>
              <div className="report-kpi-value" style={{ fontSize: '18px' }}>
                Product Sales
              </div>
              <p className="report-kpi-subtitle">
                Category and subcategory rankings by revenue and quantity.
              </p>
            </Card>

            <Card
              className="report-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/reports/customers')}
            >
              <div className="report-kpi-top">
                <span className="report-kpi-title">Customer Analytics</span>
                <div className="report-kpi-icon-wrapper">
                  <Receipt size={16} />
                </div>
              </div>
              <div className="report-kpi-value" style={{ fontSize: '18px' }}>
                Customer Sales
              </div>
              <p className="report-kpi-subtitle">
                Repeat customer rates, total purchases, and customer detail audits.
              </p>
            </Card>

            <Card
              className="report-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/reports/returns')}
            >
              <div className="report-kpi-top">
                <span className="report-kpi-title">Returns Audit</span>
                <div className="report-kpi-icon-wrapper">
                  <RotateCcw size={16} />
                </div>
              </div>
              <div className="report-kpi-value" style={{ fontSize: '18px' }}>
                Sales Returns
              </div>
              <p className="report-kpi-subtitle">
                Return rates, refunded tenders, and returned product rankings.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
