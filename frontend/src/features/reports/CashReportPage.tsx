import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Receipt,
  Download,
  Printer,
  DollarSign,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import {
  reportsApi,
  CashReportResponse,
  CashReportItem,
  ReportDatePeriod,
  SaleType,
} from './reports.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { PrintReceiptModal } from '../billing/components/PrintReceiptModal';
import './Reports.css';

export const CashReportPage: React.FC = () => {
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [saleType, setSaleType] = useState<SaleType | undefined>();
  const [page, setPage] = useState<number>(1);
  const limit = 50;

  const [data, setData] = useState<CashReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Print modal state for reprint
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const fetchCashReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getCashSalesReport({
        period,
        startDate,
        endDate,
        saleType,
        page,
        limit,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load operational cash report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCashReport();
  }, [period, startDate, endDate, saleType, page]);

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

  const handleDownloadCsv = async () => {
    try {
      setIsDownloading(true);
      const dateTag = new Date().toISOString().slice(0, 10);
      await reportsApi.downloadCashReportCsv(
        { period, startDate, endDate, saleType },
        `cash-bills-report-${dateTag}.csv`
      );
    } catch (err: any) {
      alert(`CSV export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReprint = (saleId: string) => {
    setSelectedSaleId(saleId);
    setIsPrintModalOpen(true);
  };

  const columns: ColumnDef<CashReportItem>[] = [
    {
      key: 'billNumber',
      header: 'Cash Bill #',
      cell: (row) => (
        <button
          type="button"
          onClick={() => handleReprint(row.id)}
          className="pos-bill-number-btn"
          title="Click to view/print bill"
        >
          <Receipt size={14} />
          <span>{row.billNumber}</span>
        </button>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date & Time',
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#202124' }}>
            {row.customerName || 'Walk-in Customer'}
          </div>
          {row.customerMobile && (
            <div style={{ fontSize: '11.5px', color: '#6b7280' }}>
              +91 {row.customerMobile}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'saleType',
      header: 'Sale Type',
      cell: (row) => {
        const variant =
          row.saleType === 'WHOLESALE'
            ? 'primary'
            : row.saleType === 'NRI'
            ? 'warning'
            : 'neutral';
        return (
          <Badge variant={variant as any} size="sm">
            {row.saleType}
          </Badge>
        );
      },
    },
    {
      key: 'items',
      header: 'Items / Qty',
      cell: (row) => (
        <span>
          {row.totalItemsCount} items ({row.totalQuantity})
        </span>
      ),
    },
    {
      key: 'subtotalAmount',
      header: 'Subtotal',
      align: 'right',
      cell: (row) => formatCurrency(row.subtotalAmount),
    },
    {
      key: 'discountAmount',
      header: 'Discount',
      align: 'right',
      cell: (row) =>
        row.discountAmount > 0 ? (
          <span style={{ color: '#C62828' }}>
            -{formatCurrency(row.discountAmount)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'taxAmount',
      header: 'Tax',
      align: 'right',
      cell: (row) =>
        row.taxAmount > 0 ? formatCurrency(row.taxAmount) : '₹0.00',
    },
    {
      key: 'finalTotalAmount',
      header: 'Final Total',
      align: 'right',
      cell: (row) => (
        <strong style={{ color: '#3F438F', fontSize: '13.5px' }}>
          {formatCurrency(row.finalTotalAmount)}
        </strong>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      cell: (row) => (
        <button
          type="button"
          className="pos-table-action-btn"
          onClick={() => handleReprint(row.id)}
          title="Print / View Invoice"
        >
          <Printer size={15} />
        </button>
      ),
    },
  ];

  const summary = data?.summary;
  const items = data?.items || [];
  const pagination = data?.pagination;

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Cash Bills' },
        ]}
        title="Admin Cash Bills Report"
        subtitle="Dedicated operational ledger for cash-settled transactions"
        actions={
          <div className="report-header-actions">
            <select
              aria-label="Filter cash bills by sale type tier"
              className="report-filter-select"
              value={saleType || ''}
              onChange={(e) => {
                setSaleType((e.target.value as SaleType) || undefined);
                setPage(1);
              }}
            >
              <option value="">All Tiers</option>
              <option value="RETAIL">Retail Only</option>
              <option value="NRI">NRI Only</option>
              <option value="WHOLESALE">Wholesale Only</option>
            </select>

            <ReportDateFilter
              period={period}
              startDate={startDate}
              endDate={endDate}
              onFilterChange={handleFilterChange}
              isLoading={isLoading}
            />

            <Button
              variant="outline"
              leftIcon={<Download size={15} />}
              onClick={handleDownloadCsv}
              disabled={isDownloading || isLoading || items.length === 0}
              style={{ height: '40px' }}
            >
              {isDownloading ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        }
      />

      <ReportNav />

      {error ? (
        <ErrorState
          title="Error Loading Cash Report"
          message={error}
          onRetry={fetchCashReport}
        />
      ) : (
        <>
          {/* KPI CARDS (5 cards balanced in one row on desktop) */}
          <div className="report-kpi-grid-5">
            <ReportKpiCard
              title="Cash Bills Count"
              value={summary?.cashBillCount ?? 0}
              subtitle="Completed cash bills"
              icon={<Receipt size={18} />}
              isLoading={isLoading}
            />
            <ReportKpiCard
              title="Gross Subtotal"
              value={formatCurrency(summary?.cashGrossSubtotal ?? 0)}
              subtitle="Before discounts & tax"
              icon={<Layers size={18} />}
              isLoading={isLoading}
            />
            <ReportKpiCard
              title="Cash Discounts"
              value={formatCurrency(summary?.cashTotalDiscount ?? 0)}
              subtitle="Total discounts given"
              icon={<TrendingDown size={18} />}
              badge={{ text: 'Discounts', variant: 'warning' }}
              isLoading={isLoading}
            />
            <ReportKpiCard
              title="Cash Tax Amount"
              value={formatCurrency(summary?.cashTotalTax ?? 0)}
              subtitle="Applicable GST collected"
              icon={<DollarSign size={18} />}
              isLoading={isLoading}
            />
            <ReportKpiCard
              title="Net Cash Total"
              value={formatCurrency(summary?.cashNetFinalTotal ?? 0)}
              subtitle="Net revenue in cash"
              badge={{ text: 'Cash Revenue', variant: 'success' }}
              icon={<Banknote size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* CASH BILLS DATA TABLE */}
          <div className="report-table-card">
            <div className="report-table-header">
              <div>
                <h3 className="report-table-title">Cash Transaction Ledger</h3>
                <p className="report-table-subtitle">
                  Showing {items.length} of {pagination?.total ?? 0} cash bills • Period:{' '}
                  {summary?.period || 'All Time'}
                </p>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={items}
              keyExtractor={(row) => row.id}
              isLoading={isLoading}
              emptyState={
                <ReportEmptyState
                  title="No cash bills yet"
                  description="Cash-settled completed transactions will appear here."
                  minHeight={200}
                />
              }
              page={page}
              totalPages={pagination?.totalPages || 1}
              total={pagination?.total || 0}
              limit={limit}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </>
      )}

      {/* PRINT / REPRINT MODAL */}
      <PrintReceiptModal
        isOpen={isPrintModalOpen}
        saleId={selectedSaleId}
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedSaleId(null);
        }}
      />
    </div>
  );
};
