import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Receipt,
  RotateCcw,
  Scale,
  Layers,
} from 'lucide-react';
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { TimeSeriesBarChart, PaymentBreakdownBar } from './components/ReportCharts';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { ReportExportToolbar } from './components/ReportExportToolbar';
import { DailySalesPrintModal } from './components/DailySalesPrintModal';
import {
  reportsApi,
  SalesReportData,
  ReportDatePeriod,
  GroupByInterval,
  SaleType,
} from './reports.api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import './Reports.css';

export const SalesReportPage: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<GroupByInterval>('DAY');
  const [saleType, setSaleType] = useState<SaleType | undefined>();

  const permittedSaleTypes: SaleType[] = user?.isMasterAdmin
    ? ['RETAIL', 'NRI', 'WHOLESALE']
    : (user?.allowedReportSaleTypes && user.allowedReportSaleTypes.length > 0
        ? user.allowedReportSaleTypes
        : ['RETAIL']);

  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (format === 'xlsx') setIsExportingExcel(true);
    if (format === 'pdf') setIsExportingPdf(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await reportsApi.downloadReportFile(
        '/reports/sales',
        { period, startDate, endDate, groupBy, saleType },
        format,
        `sales-report-${dateStr}.${format}`
      );
    } catch (err: any) {
      alert(err?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setIsExportingExcel(false);
      setIsExportingPdf(false);
    }
  };

  const fetchSalesReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getSalesReport({
        period,
        startDate,
        endDate,
        groupBy,
        saleType,
      });
      setSalesData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load sales performance report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesReport();
  }, [period, startDate, endDate, groupBy, saleType]);

  const handleFilterChange = (filters: {
    period?: ReportDatePeriod;
    startDate?: string;
    endDate?: string;
  }) => {
    if (filters.period) setPeriod(filters.period);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
  };

  const chartData = (salesData?.timeSeries || []).map((t) => ({
    label: t.periodKey,
    value: t.salesAmount,
    secondaryValue: t.billsCount,
    tooltip: `${t.periodKey}: ${formatCurrency(t.salesAmount)} (${t.billsCount} bills)`,
  }));

  const columns = [
    {
      key: 'periodKey',
      header: 'Date / Period',
      cell: (row: any) => (
        <span style={{ fontWeight: 600, color: '#202124' }}>
          {row.periodKey}
        </span>
      ),
    },
    {
      key: 'billsCount',
      header: 'Completed Bills',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 500 }}>{row.billsCount}</span>
      ),
    },
    {
      key: 'quantitySold',
      header: 'Quantity Sold',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block' }}>{row.quantitySold}</span>
      ),
    },
    {
      key: 'salesAmount',
      header: 'Sales Revenue',
      align: 'right' as const,
      cell: (row: any) => (
        <span
          style={{
            textAlign: 'right',
            display: 'block',
            fontWeight: 700,
            color: '#3F438F',
          }}
        >
          {formatCurrency(row.salesAmount)}
        </span>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Sales' },
        ]}
        title="Sales Performance"
        subtitle="Revenue, completed bills and transaction trends."
        actions={
          <div className="report-header-actions">
            {permittedSaleTypes.length > 1 && (
              <select
                aria-label="Filter by sale type tier"
                className="report-filter-select"
                value={saleType || ''}
                onChange={(e) => setSaleType((e.target.value as SaleType) || undefined)}
              >
                <option value="">All Permitted Tiers</option>
                {permittedSaleTypes.includes('RETAIL') && <option value="RETAIL">Retail Only</option>}
                {permittedSaleTypes.includes('NRI') && <option value="NRI">NRI Only</option>}
                {permittedSaleTypes.includes('WHOLESALE') && <option value="WHOLESALE">Wholesale Only</option>}
              </select>
            )}
            <ReportDateFilter
              period={period}
              startDate={startDate}
              endDate={endDate}
              onFilterChange={handleFilterChange}
              isLoading={isLoading}
            />
            <ReportExportToolbar
              onRefresh={fetchSalesReport}
              onExportExcel={() => handleExport('xlsx')}
              onExportPdf={() => handleExport('pdf')}
              onPrintThermal={() => setIsPrintModalOpen(true)}
              isLoading={isLoading}
              isExportingExcel={isExportingExcel}
              isExportingPdf={isExportingPdf}
              disabled={isLoading || !salesData}
            />
          </div>
        }
      />

      <ReportNav />

      {error ? (
        <ErrorState
          title="Error Loading Sales Report"
          message={error}
          onRetry={fetchSalesReport}
        />
      ) : (
        <>
          {/* Sales KPIs */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title={permittedSaleTypes.length === 3 && !saleType ? 'Total Sales Amount' : 'Authorized Sales (Scoped)'}
              value={salesData ? formatCurrency(salesData.summary.totalSalesAmount) : '₹0.00'}
              subtitle={salesData?.summary.period || 'Selected Period'}
              badge={{ text: 'Completed', variant: 'success' }}
              icon={<TrendingUp size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Completed Bills"
              value={salesData ? salesData.summary.completedBillsCount : 0}
              subtitle={
                salesData
                  ? `Avg Bill: ${formatCurrency(salesData.summary.averageBillValue)}`
                  : '0 bills recorded'
              }
              icon={<Receipt size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Quantity / Weight Sold"
              value={
                salesData
                  ? `${salesData.summary.totalQuantitySold} Units`
                  : '0 Units'
              }
              subtitle={
                salesData
                  ? `Total Weight: ${formatWeight(salesData.summary.totalWeightSold)}`
                  : '0 GM'
              }
              icon={<Scale size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Cancelled Invoices"
              value={salesData ? salesData.summary.cancelledBillsCount : 0}
              subtitle={
                salesData
                  ? `Value: ${formatCurrency(salesData.summary.cancelledAmount)}`
                  : '₹0.00'
              }
              badge={
                salesData && salesData.summary.cancelledBillsCount > 0
                  ? { text: 'Excluded from Sales', variant: 'warning' }
                  : { text: 'None', variant: 'neutral' }
              }
              icon={<RotateCcw size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* SaleType Breakdown Cards */}
          {salesData?.salesByType && !saleType && (
            <div className="report-saletype-summary-grid">
              {permittedSaleTypes.includes('RETAIL') && (
                <div className="report-saletype-summary-card">
                  <span className="report-saletype-summary-label">Retail Sales</span>
                  <span className="report-saletype-summary-val">
                    {formatCurrency(salesData.salesByType.RETAIL?.totalSalesAmount || 0)}
                  </span>
                  <span className="report-saletype-summary-sub">
                    {salesData.salesByType.RETAIL?.completedBillsCount || 0} completed bills
                  </span>
                </div>
              )}
              {permittedSaleTypes.includes('NRI') && (
                <div className="report-saletype-summary-card">
                  <span className="report-saletype-summary-label">NRI Sales</span>
                  <span className="report-saletype-summary-val">
                    {formatCurrency(salesData.salesByType.NRI?.totalSalesAmount || 0)}
                  </span>
                  <span className="report-saletype-summary-sub">
                    {salesData.salesByType.NRI?.completedBillsCount || 0} completed bills
                  </span>
                </div>
              )}
              {permittedSaleTypes.includes('WHOLESALE') && (
                <div className="report-saletype-summary-card">
                  <span className="report-saletype-summary-label">Wholesale Sales</span>
                  <span className="report-saletype-summary-val">
                    {formatCurrency(salesData.salesByType.WHOLESALE?.totalSalesAmount || 0)}
                  </span>
                  <span className="report-saletype-summary-sub">
                    {salesData.salesByType.WHOLESALE?.completedBillsCount || 0} completed bills
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Grouping interval controls & Sales trend bar chart */}
          <div className="report-bar-chart-container">
            <div className="report-section-header">
              <div>
                <h4 className="report-section-title">Sales Revenue Trend</h4>
                <span className="report-section-desc">
                  Periodic distribution of completed sales revenue
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={14} color="#64748b" />
                <select
                  aria-label="Group revenue trends by interval"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupByInterval)}
                  className="report-filter-select"
                >
                  <option value="DAY">Group by Day</option>
                  <option value="WEEK">Group by Week</option>
                  <option value="MONTH">Group by Month</option>
                </select>
              </div>
            </div>

            <TimeSeriesBarChart
              data={chartData}
              height={200}
              formatVal={formatCurrency}
              emptyTitle="No sales recorded yet"
              emptyMessage="Completed sales for the selected period will appear here."
            />
          </div>

          {/* Tender distribution & Invariant rule card */}
          <div className="report-two-col">
            <PaymentBreakdownBar
              breakdown={salesData?.paymentBreakdown || {}}
              title="Tender Payment Breakdown"
            />

            <div className="report-info-card">
              <h4 className="report-info-card-title">Reporting Invariance Rule</h4>
              <p className="report-info-card-desc">
                Sales metrics are strictly compiled from completed invoices. Cancelled
                invoices are segregated into audit metrics and excluded from turnover.
                All calculations preserve original unit rates at the time of sale.
              </p>
            </div>
          </div>

          {/* Detailed Period-Wise Table */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Sales Period Breakdown</h4>
                <span className="report-section-desc">
                  Line-by-line aggregations for {salesData?.summary.period || 'the selected period'}
                </span>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={salesData?.timeSeries || []}
              keyExtractor={(row) => row.periodKey}
              isLoading={isLoading}
              emptyState={
                <ReportEmptyState
                  title="No sales recorded yet"
                  description="Completed sales for the selected period will appear here."
                  minHeight={180}
                />
              }
            />
          </div>
        </>
      )}

      <DailySalesPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        salesData={salesData}
        saleTypeScope={saleType}
      />
    </div>
  );
};
