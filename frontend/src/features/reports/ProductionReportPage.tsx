import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  Scale,
  CheckCircle2,
  FileClock,
  Layers,
} from 'lucide-react';
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { TimeSeriesBarChart } from './components/ReportCharts';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { ReportExportToolbar } from './components/ReportExportToolbar';
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
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (format === 'xlsx') setIsExportingExcel(true);
    if (format === 'pdf') setIsExportingPdf(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await reportsApi.downloadReportFile(
        '/reports/production',
        { period, startDate, endDate, groupBy },
        format,
        `production-report-${dateStr}.${format}`
      );
    } catch (err: any) {
      alert(err?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setIsExportingExcel(false);
      setIsExportingPdf(false);
    }
  };

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
      key: 'periodKey',
      header: 'Date / Period',
      cell: (row: any) => (
        <span style={{ fontWeight: 600, color: '#202124' }}>
          {row.periodKey}
        </span>
      ),
    },
    {
      key: 'entriesCount',
      header: 'Completed Batches',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 500 }}>{row.entriesCount}</span>
      ),
    },
    {
      key: 'quantityProduced',
      header: 'Packs / Pieces',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block' }}>{row.quantityProduced}</span>
      ),
    },
    {
      key: 'baseWeightAdded',
      header: 'Total Base Weight Added',
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
          {formatWeight(row.baseWeightAdded)}
        </span>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Production' },
        ]}
        title="Production Yield & Batch Analytics"
        subtitle="Operational kitchen yields, batch completions, finished weights, and production timelines."
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
              onRefresh={fetchProductionReport}
              onExportExcel={() => handleExport('xlsx')}
              onExportPdf={() => handleExport('pdf')}
              isLoading={isLoading}
              isExportingExcel={isExportingExcel}
              isExportingPdf={isExportingPdf}
              disabled={isLoading || !productionData}
            />
          </div>
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
              subtitle={`Out of ${productionData?.summary.totalEntries || 0} total batches`}
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
                <h4 className="report-section-title">Kitchen Yield Output Trend</h4>
                <span className="report-section-desc">
                  Weight added to stock by completed production runs
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={14} color="#64748b" />
                <select
                  aria-label="Group production trend by interval"
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
              formatVal={formatWeight}
              emptyTitle="No production yield data yet"
              emptyMessage="Kitchen yield output will appear once completed production batches are recorded."
            />
          </div>

          {/* Period Breakdown Table */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Production Period Log</h4>
                <span className="report-section-desc">
                  Batch yields and finished quantities for {productionData?.summary.period || 'the period'}
                </span>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={productionData?.timeSeries || []}
              keyExtractor={(row) => row.periodKey}
              isLoading={isLoading}
              emptyState={
                <ReportEmptyState
                  title="No production batches yet"
                  description="Production logs will appear here once completed batches are recorded."
                  minHeight={180}
                />
              }
            />
          </div>
        </>
      )}
    </div>
  );
};
