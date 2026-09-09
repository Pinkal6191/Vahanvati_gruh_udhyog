import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Printer,
  Eye,
  XCircle,
  Plus,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { SearchInput } from '../../components/forms/SearchInput/SearchInput';
import { Select } from '../../components/forms/Select/Select';
import { Modal } from '../../components/ui/Modal/Modal';
import { Input } from '../../components/forms/Input/Input';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { BillDetailsDrawer } from './components/BillDetailsDrawer';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  BillingApi,
  SaleRecord,
  SalesQueryFilter,
} from './billing.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const BillHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchBill, setSearchBill] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modals & Drawers
  const [viewingSale, setViewingSale] = useState<SaleRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Cancel Modal state
  const [cancellingSale, setCancellingSale] = useState<SaleRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const isAdmin = user?.role === 'ADMIN';

  // Load Sales Data
  const loadSales = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query: SalesQueryFilter = {
        page,
        limit,
        billNumber: searchBill.trim() || undefined,
        saleStatus: (statusFilter || undefined) as any,
        paymentMode: (paymentFilter || undefined) as any,
        date: dateFilter || undefined,
      };

      const res = await BillingApi.listSales(query);
      setSales(res.items || []);
      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load past sales bills.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchBill, statusFilter, paymentFilter, dateFilter]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Open Details
  const handleOpenDetails = (sale: SaleRecord) => {
    setViewingSale(sale);
    setIsDetailsOpen(true);
  };

  // Open Print
  const handleOpenPrint = (sale: SaleRecord) => {
    setPrintingSaleId(sale.id);
    setIsPrintModalOpen(true);
  };

  // Submit Bill Cancellation (Admin only)
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSale) return;
    setCancelError(null);

    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setCancelError('Please provide a reason for cancellation (at least 3 characters).');
      return;
    }

    setIsCancelling(true);
    try {
      await BillingApi.cancelSale(cancellingSale.id, cancelReason.trim());
      addToast({
        title: 'Bill Cancelled',
        message: `Bill #${cancellingSale.billNumber} has been cancelled and stock reversed.`,
        variant: 'warning',
      });
      setCancellingSale(null);
      setCancelReason('');
      await loadSales();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel bill.');
    } finally {
      setIsCancelling(false);
    }
  };

  const columns: ColumnDef<SaleRecord>[] = [
    {
      key: 'billNumber',
      header: 'Bill Number',
      width: '180px',
      cell: (row) => (
        <button
          type="button"
          className="pos-bill-number-btn"
          onClick={() => handleOpenDetails(row)}
          title="Click to view details"
        >
          <Receipt size={14} />
          <strong>{row.billNumber}</strong>
        </button>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date & Time',
      width: '180px',
      cell: (row) => (
        <span className="date-text">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      width: '200px',
      cell: (row) => (
        <div className="pos-customer-cell">
          <span className="pos-customer-cell-name">
            {row.customerNameSnapshot || 'Walk-in Customer'}
          </span>
          <Badge
            variant={row.customerTypeSnapshot === 'NRI' ? 'warning' : 'brand'}
            size="sm"
          >
            {row.customerTypeSnapshot}
          </Badge>
        </div>
      ),
    },
    {
      key: 'itemsCount',
      header: 'Items',
      width: '80px',
      align: 'center',
      cell: (row) => <span>{row.items?.length || 0}</span>,
    },
    {
      key: 'finalTotalAmount',
      header: 'Total Amount',
      width: '130px',
      align: 'right',
      cell: (row) => (
        <strong className="pos-table-amount">
          {formatCurrency(row.finalTotalAmount)}
        </strong>
      ),
    },
    {
      key: 'paymentMode',
      header: 'Payment',
      width: '100px',
      align: 'center',
      cell: (row) => (
        <span className="pos-payment-mode-pill">
          {row.payments?.[0]?.paymentMode || 'CASH'}
        </span>
      ),
    },
    {
      key: 'saleStatus',
      header: 'Status',
      width: '110px',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.saleStatus === 'COMPLETED' ? 'success' : 'danger'}
          size="sm"
        >
          {row.saleStatus}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '140px',
      align: 'right',
      cell: (row) => (
        <div className="table-action-buttons">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDetails(row)}
            title="View Bill Details"
          >
            <Eye size={15} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenPrint(row)}
            title="Print / Reprint Receipt"
          >
            <Printer size={15} />
          </Button>

          {isAdmin && row.saleStatus === 'COMPLETED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCancellingSale(row);
                setCancelReason('');
                setCancelError(null);
              }}
              title="Cancel bill (Admin only)"
            >
              <XCircle size={15} className="text-danger" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="master-data-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Billing POS', path: '/billing' },
          { label: 'Bill History' },
        ]}
      />

      <PageHeader
        title="Bill & Invoice History"
        subtitle="Search past invoices, review line items, reprint thermal receipts, and audit transactions."
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => navigate('/billing')}
          >
            New Bill (POS)
          </Button>
        }
      />

      {/* FILTER BAR */}
      <div className="master-filters-card">
        <div className="master-filters-grid">
          <SearchInput
            placeholder="Search by Bill Number (e.g. VGU-)..."
            value={searchBill}
            onChange={(e) => {
              setSearchBill(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearchBill('');
              setPage(1);
            }}
            className="filter-search-input"
          />

          <Select
            label=""
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'COMPLETED', label: 'Completed Only' },
              { value: 'CANCELLED', label: 'Cancelled Only' },
            ]}
            className="filter-select-input"
          />

          <Select
            label=""
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Payment Modes' },
              { value: 'CASH', label: 'Cash Only' },
              { value: 'UPI', label: 'UPI Only' },
              { value: 'CARD', label: 'Card Only' },
              { value: 'OTHER', label: 'Other Only' },
            ]}
            className="filter-select-input"
          />

          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="filter-date-input"
          />

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={loadSales}
            className="filter-refresh-btn"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Could Not Load Sales History"
          message={error}
          onRetry={loadSales}
        />
      )}

      {/* DATA TABLE */}
      {!error && (
        <>
          <DataTable
            columns={columns}
            data={sales}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="No sales bills found matching filter criteria."
          />

          {totalPages > 1 && (
            <div className="master-pagination-wrapper">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
                total={totalCount}
                limit={limit}
              />
            </div>
          )}
        </>
      )}

      {/* DRAWERS & MODALS */}
      <BillDetailsDrawer
        isOpen={isDetailsOpen}
        sale={viewingSale}
        onClose={() => setIsDetailsOpen(false)}
        onReprint={(s) => handleOpenPrint(s)}
      />

      <PrintReceiptModal
        isOpen={isPrintModalOpen}
        saleId={printingSaleId}
        onClose={() => setIsPrintModalOpen(false)}
      />

      {/* CANCEL BILL CONFIRMATION MODAL (ADMIN ONLY) */}
      <Modal
        isOpen={!!cancellingSale}
        onClose={() => !isCancelling && setCancellingSale(null)}
        title={`Cancel Bill: ${cancellingSale?.billNumber}`}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancellingSale(null)}
              disabled={isCancelling}
            >
              Back
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              isLoading={isCancelling}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <form onSubmit={handleConfirmCancel} className="modal-form-vertical">
          <div className="pos-cancel-warning-box">
            <AlertTriangle size={24} className="text-danger" />
            <p>
              Warning: Cancelling Bill #{cancellingSale?.billNumber} for{' '}
              <strong>{formatCurrency(cancellingSale?.finalTotalAmount || 0)}</strong> will
              reverse the inventory deductions back into current stock via the StockService.
            </p>
          </div>

          {cancelError && (
            <div className="form-error-banner" role="alert">
              {cancelError}
            </div>
          )}

          <Input
            label="Cancellation Reason *"
            id="cancelReason"
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Customer changed mind, incorrect line item"
            isRequired
            autoFocus
            helperText="Reason is recorded permanently in the system audit log"
          />
        </form>
      </Modal>
    </div>
  );
};
