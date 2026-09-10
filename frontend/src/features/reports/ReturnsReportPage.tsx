import React, { useEffect, useState } from 'react';
import {
  RotateCcw,
  Percent,
  Wallet,
  Package,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { PaymentBreakdownBar } from './components/ReportCharts';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Card } from '../../components/ui/Card/Card';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  ReturnsReportData,
  ReportDatePeriod,
} from './reports.api';
import { formatCurrency } from '../../utils/formatters';
import './Reports.css';

export const ReturnsReportPage: React.FC = () => {
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

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

  const columns = [
    {
      key: 'productName',
      header: 'Returned Product',
      cell: (row: any) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
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
            color: 'var(--color-primary-600, #2563eb)',
          }}
        >
          {formatCurrency(row.refundAmount)}
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
          { label: 'Sales Returns' },
        ]}
      />

      <PageHeader
        title="Sales Returns & Refund Audit"
        subtitle="Return frequencies, Return Rate percentage, tender refund methods, and returned product rankings."
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
              subtitle={`Of ${returnsData ? formatCurrency(returnsData.summary.completedSalesAmount) : '₹0.00'} completed sales`}
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

            <Card style={{ padding: '20px' }}>
              <h4 className="report-section-title" style={{ marginBottom: '8px' }}>
                Return Rate Formula
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Return Rate is defined by the authoritative Step 9 reporting engine as:
                <br />
                <code
                  style={{
                    display: 'block',
                    margin: '8px 0',
                    padding: '6px 10px',
                    background: '#f1f5f9',
                    borderRadius: '4px',
                    color: '#0f172a',
                    fontWeight: 600,
                  }}
                >
                  (Completed Return Total / Completed Sales Total) × 100
                </code>
                Refunds strictly observe historical unit rates locked at original sale creation.
              </p>
            </Card>
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
              emptyMessage="No returns recorded for this period."
            />
          </div>
        </>
      )}
    </div>
  );
};
