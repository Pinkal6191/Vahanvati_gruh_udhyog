import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, PlusCircle, Search, Eye } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { salesReturnsApi, SalesReturn } from './sales-returns.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import './SalesReturnsPage.css';

export const SalesReturnsHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [returnsList, setReturnsList] = useState<SalesReturn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await salesReturnsApi.list({
        returnNumber: search.trim().toUpperCase().startsWith('RET') ? search.trim() : undefined,
        originalBillNumber: !search.trim().toUpperCase().startsWith('RET') && search.trim() ? search.trim() : undefined,
        status: 'COMPLETED',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });

      setReturnsList(res.items || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sales returns history');
    } finally {
      setIsLoading(false);
    }
  }, [search, startDate, endDate, page, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const columns: ColumnDef<SalesReturn>[] = [
    {
      header: 'Return Number',
      key: 'returnNumber',
      cell: (row) => (
        <span
          className="return-number-badge"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/sales-returns/${row.id}`)}
          title="Click to view details"
        >
          {row.returnNumber}
        </span>
      ),
    },
    {
      header: 'Original Bill',
      key: 'originalBillNumber',
      cell: (row) => <span className="original-bill-badge">#{row.originalBillNumber}</span>,
    },
    {
      header: 'Completed Date',
      key: 'completedAt',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
          {formatDateTime(row.completedAt || row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Customer',
      key: 'customerName',
      cell: (row) => <span>{row.customerName || 'Walk-in Customer'}</span>,
    },
    {
      header: 'Refund Amount',
      key: 'totalReturnAmount',
      cell: (row) => (
        <span className="refund-amount-cell">{formatCurrency(row.totalReturnAmount)}</span>
      ),
    },
    {
      header: 'Refund Mode',
      key: 'refundPaymentMode',
      cell: (row) => <span>{row.refundPaymentMode}</span>,
    },
    {
      header: 'Status',
      key: 'status',
      cell: () => <Badge variant="success">Completed</Badge>,
    },
    {
      header: 'Processed By',
      key: 'createdBy',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {row.createdBy?.fullName || row.createdBy?.username || 'Staff'}
        </span>
      ),
    },
    {
      header: 'Actions',
      key: 'id',
      cell: (row) => (
        <div className="actions-cell">
          <button
            type="button"
            className="pos-table-action-btn pos-action-btn-view"
            onClick={() => navigate(`/sales-returns/${row.id}`)}
            title="View Details"
          >
            <Eye size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="module-shell-page returns-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Sales Returns', path: '/sales-returns' },
          { label: 'Returns History' },
        ]}
      />

      <PageHeader
        title="Completed Sales Returns"
        subtitle="Archival ledger of completed returns that have successfully refunded customers and restored warehouse stock."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              onClick={() => navigate('/sales-returns')}
            >
              New Return
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="returns-filter-toolbar">
        <div className="returns-search-group">
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', paddingLeft: '36px' }}
              placeholder="Search historical returns..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="toolbar-filters">
          <input
            type="date"
            className="filter-select"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />

          <input
            type="date"
            className="filter-select"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />

          {(search || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card>
        {isLoading ? (
          <LoadingState message="Loading completed returns..." />
        ) : error ? (
          <ErrorState
            title="Error Loading Return History"
            message={error}
            onRetry={fetchHistory}
          />
        ) : returnsList.length === 0 ? (
          <EmptyState
            icon={<History size={48} />}
            title="No Completed Returns Found"
            description="No completed returns match the selected filter criteria."
          />
        ) : (
          <>
            <DataTable data={returnsList} columns={columns} keyExtractor={(row) => row.id} />
            <Pagination
              page={page}
              totalPages={totalPages}
              total={totalItems}
              limit={limit}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
};
