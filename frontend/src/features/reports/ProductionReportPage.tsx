import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  Scale,
  CheckCircle2,
  FileClock,
  Ban,
  Layers,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { TimeSeriesBarChart } from './components/ReportCharts';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  ProductionReportData,
  ReportDatePeriod,
  GroupByInterval,
} from './reports.api';
import { formatWeight } from '../../utils/formatters';
import './Reports.css';

export const ProductionReportPage: React.FC = () => {
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<GroupByInterval>('DAY');

  const [productionData, setProductionData] = useState<ProductionReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductionReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getProductionReport({
        period,
        startDate,
        endDate,
        groupBy,
      });
      setProductionData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load production analytics report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductionReport();
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

  const chartData = (productionData?.timeSeries || []).map((t) => ({
    label: t.periodKey,
    value: t.baseWeightAdded,
    secondaryValue: t.entriesCount,
    tooltip: `${t.periodKey}: ${formatWeight(t.baseWeightAdded)} (${t.entriesCount} batches)`,
  }));

  const columns = [
    {
      key: 'productName',
      header: 'Product',
      cell: (row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.productName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Code: {row.productCode}
          </div>
        </div>
      ),
    },
    {
      key: 'entriesCount',
      header: 'Completed Batches',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block' }}>{row.entriesCount}</span>
      ),
    },
    {
      key: 'completedQuantity',
      header: 'Output Quantity',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {row.completedQuantity}
        </span>
      ),
    },
    {
      key: 'completedBaseWeight',
      header: 'Total Base Weight Added',
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
          {formatWeight(row.completedBaseWeight)}
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
          { label: 'Production Report' },
        ]}
      />

      <PageHeader
        title="Production Yield & Batch Analytics"
        subtitle="Operational kitchen yields, batch completions, finished weights, and production timelines."
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
          title="Error Loading Production Report"
          message={error}
          onRetry={fetchProductionReport}
        />
      ) : (
        <>
          {/* Production Summary KPIs */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Total Yield Weight"
              value={
                productionData
                  ? formatWeight(productionData.summary.totalCompletedBaseWeightAdded)
                  : '0 GM'
              }
              subtitle={productionData?.summary.period || 'Selected Period'}
              badge={{ text: 'Completed', variant: 'success' }}
              icon={<Scale size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Completed Batches"
              value={productionData ? productionData.summary.completedEntriesCount : 0}
              subtitle={`Out of ${productionData?.summary.totalEntries || 0} total logs`}
              icon={<CheckCircle2 size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Units Produced"
              value={
                productionData
                  ? `${productionData.summary.totalCompletedQuantityProduced} Units`
                  : '0 Units'
              }
              subtitle="Finished packs & units"
              icon={<ChefHat size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Draft & Cancelled"
              value={
                productionData
                  ? `${productionData.summary.draftEntriesCount} Draft / ${productionData.summary.cancelledEntriesCount} Can`
                  : '0'
              }
              subtitle="Non-completed batches"
              badge={
                productionData && productionData.summary.draftEntriesCount > 0
                  ? { text: 'Open Drafts', variant: 'warning' }
                  : { text: 'None', variant: 'neutral' }
              }
              icon={<FileClock size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* Production Trends Bar Chart */}
          <div className="report-bar-chart-container">
            <div className="report-section-header">
              <div>
                <h4 className="report-chart-title" style={{ margin: 0 }}>
                  Kitchen Yield Output Trend
                </h4>
                <span className="report-section-desc">
                  Weight added to stock by completed production runs
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
              formatVal={formatWeight}
              emptyMessage="No completed production batches in this period."
            />
          </div>

          {/* Product-wise Production Breakdown Table */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Product Production Breakdown</h4>
                <span className="report-section-desc">
                  Completed batches and manufactured weights by item
                </span>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={productionData?.productBreakdown || []}
              keyExtractor={(row) => row.productId}
              isLoading={isLoading}
              emptyMessage="No production output logged for this period."
            />
          </div>
        </>
      )}
    </div>
  );
};
