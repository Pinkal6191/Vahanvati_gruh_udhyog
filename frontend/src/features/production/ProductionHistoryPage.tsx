import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, PlusCircle, Search, Eye, CheckCircle2 } from 'lucide-react';
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
import { productionApi, ProductionEntry } from './production.api';
import { formatDate } from '../../utils/formatters';
import './ProductionPage.css';

export const ProductionHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productionApi.list({
        search: search.trim() || undefined,
        status: 'COMPLETED',
        date: dateFilter || undefined,
        page,
        limit,
      } as any);

      setEntries(res.items || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load historical batch entries');
    } finally {
      setIsLoading(false);
    }
  }, [search, dateFilter, page, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const columns: ColumnDef<ProductionEntry>[] = [
    {
      header: 'Batch Number',
      key: 'batchNumber',
      cell: (row) => (
        <span
          className="batch-number-badge"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/production/${row.id}`)}
          title="Click to view batch details"
        >
          {row.batchNumber}
        </span>
      ),
    },
    {
      header: 'Date',
      key: 'productionDate',
      cell: (row) => <span>{formatDate(row.productionDate)}</span>,
    },
    {
      header: 'Product',
      key: 'product',
      cell: (row) => (
        <div className="product-cell">
          <span className="product-name-en">{row.product?.name}</span>
          {row.product?.gujaratiName && (
            <span className="product-name-gu">{row.product.gujaratiName}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Output',
      key: 'quantityProduced',
      cell: (row) => (
        <span className="quantity-value">
          {row.quantityProduced} {row.unit?.symbol}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: () => <Badge variant="success">Completed</Badge>,
    },
    {
      header: 'Operator',
      key: 'user',
      cell: (row) => <span>{row.user?.fullName || row.user?.username || 'System'}</span>,
    },
    {
      header: 'Actions',
      key: 'id',
      cell: (row) => (
        <div className="actions-cell">
          <button
            type="button"
            className="pos-table-action-btn pos-action-btn-view"
            onClick={() => navigate(`/production/${row.id}`)}
            title="View Details"
          >
            <Eye size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="module-shell-page production-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Production', path: '/production' },
          { label: 'Batch Records' },
        ]}
      />

      <PageHeader
        title="Completed Production Batches"
        subtitle="Archival ledger of completed manufacturing batches that were successfully credited to inventory."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              onClick={() => navigate('/production')}
            >
              New Batch Entry
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="production-filter-toolbar">
        <div className="toolbar-search">
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={16}
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
              placeholder="Search history by batch code, product name..."
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
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
          />

          {(search || dateFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setDateFilter('');
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
          <LoadingState message="Loading historical batches..." />
        ) : error ? (
          <ErrorState
            title="Error Loading Batch History"
            message={error}
            onRetry={fetchHistory}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<History size={48} />}
            title="No Completed Batches Found"
            description="No completed batches match the selected criteria."
          />
        ) : (
          <>
            <DataTable data={entries} columns={columns} keyExtractor={(row) => row.id} />
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
