import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Receipt,
  RotateCcw,
  Scale,
  Calendar,
  Layers,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { TimeSeriesBarChart, PaymentBreakdownBar } from './components/ReportCharts';
import { Card } from '../../components/ui/Card/Card';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  SalesReportData,
  ReportDatePeriod,
  GroupByInterval,
} from './reports.api';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import './Reports.css';

export const SalesReportPage: React.FC = () => {
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<GroupByInterval>('DAY');

  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSalesReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getSalesReport({
        period,
        startDate,
        endDate,
        groupBy,
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
  }, [period, startDate, endDate, groupBy]);

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
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {row.periodKey}
        </span>
      ),
    },
    {
      key: 'billsCount',
      header: 'Completed Bills',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block' }}>{row.billsCount}</span>
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
            color: 'var(--color-primary-600, #2563eb)',
          }}
        >
          {formatCurrency(row.salesAmount)}
        </span>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports', path: '/reports' },
          { label: 'Sales Report' },
        ]}
      />

      <PageHeader
        title="Sales Performance Report"
        subtitle="Detailed revenue insights, completed transaction counts, average bill value, and tender breakdown."
        actions={
          <ReportDateFilter
            period={period}
            startDate={startDate}
            endDate={endDate}
            onFilterChange={handleFilterChange}
            isLoading={isLoading}
          />
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
              title="Total Sales Amount"
              value={salesData ? formatCurrency(salesData.summary.totalSalesAmount) : '₹0.00'}
              subtitle={salesData?.summary.period || 'Period'}
              badge={{ text: 'Completed', variant: 'success' }}
              icon={<TrendingUp size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Completed Bills"
              value={salesData ? salesData.summary.completedBillsCount : 0}
              subtitle={
                salesData
                  ? `ABV: ${formatCurrency(salesData.summary.averageBillValue)}`
                  : '0 bills'
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

          {/* Grouping interval controls & Sales trend bar chart */}
          <div className="report-bar-chart-container">
            <div className="report-section-header">
              <div>
                <h4 className="report-chart-title" style={{ margin: 0 }}>
                  Sales Revenue Trend
                </h4>
                <span className="report-section-desc">
                  Periodic distribution of completed retail sales
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={14} color="#64748b" />
                <select
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
              height={220}
              formatVal={formatCurrency}
              emptyMessage="No completed sales found in this period."
            />
          </div>

          {/* Tender distribution & Date-wise breakdown table */}
          <div className="report-two-col">
            {/* Payment Mode Breakdown */}
            <PaymentBreakdownBar
              breakdown={salesData?.paymentBreakdown || {}}
              title="Tender Payment Breakdown"
            />

            {/* Invariant Note Card */}
            <Card style={{ padding: '20px' }}>
              <h4 className="report-section-title" style={{ marginBottom: '8px' }}>
                Reporting Invariance Rule
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Sales metrics are strictly compiled from completed invoices. Cancelled
                invoices are segregated into audit metrics and excluded from turnover.
                All calculations preserve original unit rates at the time of sale.
              </p>
            </Card>
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
              emptyMessage="No sales recorded for this timeframe."
            />
          </div>
        </>
      )}
    </div>
  );
};
