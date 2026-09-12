import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { Badge } from '../../components/ui/Badge/Badge';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  StockMovementsReportResponse,
  ReportDatePeriod,
  StockMovementRecord,
  MovementType,
} from './reports.api';
import { formatDateTime, formatGramsToKg, formatDeltaWeight } from '../../utils/formatters';
import './Reports.css';

export const StockMovementsReportPage: React.FC = () => {
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [movementType, setMovementType] = useState<MovementType | undefined>();
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  const [movementsData, setMovementsData] = useState<StockMovementsReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMovements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getStockMovementsReport({
        period,
        startDate,
        endDate,
        movementType,
        page,
        limit,
      });
      setMovementsData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load stock movements ledger.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [period, startDate, endDate, movementType, page]);

  const handleFilterChange = (filters: {
    period?: ReportDatePeriod;
    startDate?: string;
    endDate?: string;
  }) => {
    if (filters.period) setPeriod(filters.period);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setPage(1);
  };

  const getMovementBadgeVariant = (type: MovementType): 'success' | 'danger' | 'warning' | 'info' | 'neutral' => {
    switch (type) {
      case 'PRODUCTION_IN':
      case 'SALES_RETURN_IN':
      case 'PURCHASE_IN':
        return 'success';
      case 'SALE_OUT':
      case 'SCRAP_OUT':
        return 'danger';
      case 'ADJUSTMENT_IN':
      case 'ADJUSTMENT_OUT':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const columns = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      cell: (row: StockMovementRecord) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      cell: (row: StockMovementRecord) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.product.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Code: {row.product.code}
          </div>
        </div>
      ),
    },
    {
      key: 'movementType',
      header: 'Movement Type',
      cell: (row: StockMovementRecord) => (
        <Badge variant={getMovementBadgeVariant(row.movementType)} size="sm">
          {row.movementType}
        </Badge>
      ),
    },
    {
      key: 'quantityDelta',
      header: 'Change',
      align: 'right' as const,
      cell: (row: StockMovementRecord) => {
        const num = Number(row.quantityDelta);
        const isPositive = num > 0;
        return (
          <span
            style={{
              textAlign: 'right',
              display: 'block',
              fontWeight: 700,
              color: isPositive ? '#059669' : '#dc2626',
            }}
          >
            {formatDeltaWeight(num)}
          </span>
        );
      },
    },
    {
      key: 'balanceAfter',
      header: 'Balance After',
      align: 'right' as const,
      cell: (row: StockMovementRecord) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {formatGramsToKg(row.balanceAfter)}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      cell: (row: StockMovementRecord) => (
        <div>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>{row.referenceType}</span>
          {row.notes && (
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {row.notes}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'operator',
      header: 'Operator',
      cell: (row: StockMovementRecord) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {row.user ? row.user.fullName || row.user.username : 'System'}
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
          { label: 'Stock Movements' },
        ]}
      />

      <PageHeader
        title="Stock Movements Audit Ledger"
        subtitle="Chronological, double-entry inventory transaction ledger tracking all inflows and outflows."
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
          title="Error Loading Movements Ledger"
          message={error}
          onRetry={fetchMovements}
        />
      ) : (
        <>
          {/* Movement summary cards */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Total Movements"
              value={movementsData ? movementsData.summary.totalMovements : 0}
              subtitle={movementsData?.summary.period || 'Selected Period'}
              icon={<ArrowLeftRight size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Kitchen Output (IN)"
              value={
                movementsData
                  ? `+${movementsData.summary.movementBreakdown['PRODUCTION_IN']?.totalDelta || 0}`
                  : '0'
              }
              subtitle={`${movementsData?.summary.movementBreakdown['PRODUCTION_IN']?.count || 0} batches produced`}
              badge={{ text: 'Production', variant: 'success' }}
              icon={<ArrowDownLeft size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Sales Deductions (OUT)"
              value={
                movementsData
                  ? `${movementsData.summary.movementBreakdown['SALE_OUT']?.totalDelta || 0}`
                  : '0'
              }
              subtitle={`${movementsData?.summary.movementBreakdown['SALE_OUT']?.count || 0} customer sales`}
              badge={{ text: 'Dispatched', variant: 'danger' }}
              icon={<ArrowUpRight size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Returns Restocked (IN)"
              value={
                movementsData
                  ? `+${movementsData.summary.movementBreakdown['SALES_RETURN_IN']?.totalDelta || 0}`
                  : '0'
              }
              subtitle={`${movementsData?.summary.movementBreakdown['SALES_RETURN_IN']?.count || 0} restocked returns`}
              badge={{ text: 'Returns', variant: 'warning' }}
              icon={<ArrowDownLeft size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* Table Card */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Audit Ledger Entries</h4>
                <span className="report-section-desc">
                  Immutable movement log entries
                </span>
              </div>

              <div className="report-table-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={14} color="#64748b" />
                  <select
                    value={movementType || ''}
                    onChange={(e) => {
                      setMovementType(e.target.value ? (e.target.value as MovementType) : undefined);
                      setPage(1);
                    }}
                    className="report-filter-select"
                  >
                    <option value="">All Movement Types</option>
                    <option value="PRODUCTION_IN">Production In</option>
                    <option value="SALE_OUT">Sale Out</option>
                    <option value="SALES_RETURN_IN">Sales Return In</option>
                    <option value="ADJUSTMENT_IN">Adjustment In</option>
                    <option value="ADJUSTMENT_OUT">Adjustment Out</option>
                  </select>
                </div>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={movementsData?.data || []}
              keyExtractor={(row) => row.id}
              isLoading={isLoading}
              emptyMessage="No stock movements recorded for this period."
              page={movementsData?.pagination.page}
              totalPages={movementsData?.pagination.totalPages}
              total={movementsData?.pagination.total}
              limit={movementsData?.pagination.limit}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </>
      )}
    </div>
  );
};
