import React, { useEffect, useState } from 'react';
import {
  RotateCcw,
  Percent,
  Wallet,
  Package,
} from 'lucide-react';
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { PaymentBreakdownBar } from './components/ReportCharts';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  ReturnsReportData,
  ReportDatePeriod,
  SaleType,
} from './reports.api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';
import './Reports.css';

export const ReturnsReportPage: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [saleType, setSaleType] = useState<SaleType | undefined>();

  const permittedSaleTypes: SaleType[] = user?.isMasterAdmin
    ? ['RETAIL', 'NRI', 'WHOLESALE']
    : (user?.allowedReportSaleTypes && user.allowedReportSaleTypes.length > 0
        ? user.allowedReportSaleTypes
        : ['RETAIL']);

  const [returnsData, setReturnsData] = useState<ReturnsReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReturnsReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getReturnsReport({
        period,
        startDate,
        endDate,
        saleType,
      });
      setReturnsData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load sales returns report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnsReport();
  }, [period, startDate, endDate, saleType]);

  const handleFilterChange = (filters: {
    period?: ReportDatePeriod;
    startDate?: string;
    endDate?: string;
  }) => {
    if (filters.period) setPeriod(filters.period);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
  };

  const columns = [
    {
      key: 'productName',
      header: 'Returned Product',
      cell: (row: any) => (
        <span style={{ fontWeight: 600, color: '#202124' }}>
          {row.productName}
        </span>
      ),
    },
    {
      key: 'returnedQuantity',
      header: 'Returned Units',
      align: 'right' as const,
      cell: (row: any) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {row.returnedQuantity}
        </span>
      ),
    },
    {
      key: 'refundAmount',
      header: 'Total Refund Value',
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
          {formatCurrency(row.refundAmount)}
        </span>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Returns' },
        ]}
        title="Sales Returns & Refund Audit"
        subtitle="Return frequencies, Return Rate percentage, tender refund methods, and returned product rankings."
        actions={
          <div className="report-header-actions">
            {permittedSaleTypes.length > 1 && (
              <select
                aria-label="Filter returns by sale type tier"
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
          </div>
        }
      />

      <ReportNav />

      {error ? (
        <ErrorState
          title="Error Loading Returns Report"
          message={error}
          onRetry={fetchReturnsReport}
        />
      ) : (
        <>
          {/* Returns KPIs */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Total Refund Amount"
              value={returnsData ? formatCurrency(returnsData.summary.totalRefundAmount) : '₹0.00'}
              subtitle={returnsData?.summary.period || 'Selected Period'}
              badge={{ text: 'Refunded', variant: 'warning' }}
              icon={<Wallet size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Completed Returns"
              value={returnsData ? returnsData.summary.completedReturnsCount : 0}
              subtitle={`Total: ${returnsData?.summary.totalReturns || 0} (${returnsData?.summary.draftReturnsCount || 0} drafts, ${returnsData?.summary.cancelledReturnsCount || 0} can)`}
              icon={<RotateCcw size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Return Rate"
              value={
                returnsData
                  ? `${returnsData.summary.returnRate}%`
                  : '0%'
              }
              subtitle={`Of ${returnsData ? formatCurrency(returnsData.summary.completedSalesAmount) : '₹0.00'} sales`}
              badge={{
                text:
                  returnsData && returnsData.summary.returnRate > 5
                    ? 'High'
                    : 'Normal',
                variant:
                  returnsData && returnsData.summary.returnRate > 5
                    ? 'danger'
                    : 'success',
              }}
              icon={<Percent size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Returned Units"
              value={returnsData ? returnsData.summary.totalReturnedQuantity : 0}
              subtitle="Physical items returned"
              icon={<Package size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* Refund Breakdown Bar & Formula Card */}
          <div className="report-two-col">
            <PaymentBreakdownBar
              breakdown={returnsData?.paymentModeBreakdown || {}}
              title="Refund Tender Distribution"
            />

            <div className="report-info-card">
              <h4 className="report-info-card-title">Return Rate Formula</h4>
              <p className="report-info-card-desc">
                Calculated on completed returns against completed sales for the selected period:
              </p>
              <code className="report-formula-code">
                (Completed Return Total / Completed Sales Total) × 100
              </code>
              <p className="report-info-card-desc" style={{ marginTop: '6px' }}>
                All refund audits strictly observe historical unit rates locked at the original sale creation.
              </p>
            </div>
          </div>

          {/* Product Returns Breakdown Table */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Product-Wise Returns Ranking</h4>
                <span className="report-section-desc">
                  Ranked by total refund value refunded to customers
                </span>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={returnsData?.productBreakdown || []}
              keyExtractor={(row) => row.productId}
              isLoading={isLoading}
              emptyState={
                <ReportEmptyState
                  title="No returns recorded"
                  description="Completed sales returns for this period will appear here."
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
