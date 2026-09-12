import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Package,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  inventoryApi,
  StockMovement,
  MovementType,
  MovementQueryParams,
} from './inventory.api';
import { formatDateTime, formatGramsToKg, formatDeltaWeight } from '../../utils/formatters';
import './StockPage.css';

export const StockMovementsPage: React.FC = () => {
  const navigate = useNavigate();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchMovements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: MovementQueryParams = {
        movementType: movementType || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined,
        page,
        limit,
      };

      const res = await inventoryApi.listMovements(params);
      setMovements(res.items || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stock movement history');
    } finally {
      setIsLoading(false);
    }
  }, [movementType, startDate, endDate, page, limit]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Movement Direction Badge
  const renderMovementTypeBadge = (type: MovementType) => {
    switch (type) {
      case 'PRODUCTION_IN':
        return (
          <span className="movement-badge-in">
            <ArrowDownLeft size={13} /> Production In
          </span>
        );
      case 'SALES_RETURN_IN':
        return (
          <span className="movement-badge-in">
            <ArrowDownLeft size={13} /> Return In
          </span>
        );
      case 'ADJUSTMENT_IN':
        return (
          <span className="movement-badge-in">
            <SlidersHorizontal size={13} /> Adjust In (+)
          </span>
        );
      case 'SALE_OUT':
        return (
          <span className="movement-badge-out">
            <ArrowUpRight size={13} /> Sale Out
          </span>
        );
      case 'ADJUSTMENT_OUT':
        return (
          <span className="movement-badge-out">
            <SlidersHorizontal size={13} /> Adjust Out (-)
          </span>
        );
      default:
        return <span>{type}</span>;
    }
  };

  const columns: ColumnDef<StockMovement>[] = [
    {
      header: 'Timestamp',
      key: 'createdAt',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Product',
      key: 'productName',
      cell: (row) => (
        <div className="product-cell">
          <span className="product-name-en">{row.productName}</span>
          <span className="product-code-sub">Code: {row.productCode}</span>
        </div>
      ),
    },
    {
      header: 'Movement Type',
      key: 'movementType',
      cell: (row) => renderMovementTypeBadge(row.movementType),
    },
    {
      header: 'Quantity Delta',
      key: 'quantityDelta',
      cell: (row) => {
        const isPositive = row.quantityDelta > 0;
        return (
          <span className={isPositive ? 'movement-quantity-in' : 'movement-quantity-out'}>
            {formatDeltaWeight(row.quantityDelta)}
          </span>
        );
      },
    },
    {
      header: 'Balance After',
      key: 'balanceAfter',
      cell: (row) => (
        <span style={{ fontWeight: 600 }}>
          {formatGramsToKg(row.balanceAfter)}
        </span>
      ),
    },
    {
      header: 'Reference',
      key: 'referenceType',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {row.referenceType}
        </span>
      ),
    },
    {
      header: 'Logged By',
      key: 'createdBy',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {row.createdBy?.fullName || row.createdBy?.username || 'System'}
        </span>
      ),
    },
    {
      header: 'Notes',
      key: 'notes',
      cell: (row) => (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}
          title={row.notes || ''}
        >
          {row.notes || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="module-shell-page stock-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Inventory', path: '/inventory' },
          { label: 'Stock Movements' },
        ]}
      />

      <PageHeader
        title="Stock Movements & Ledger"
        subtitle="Immutable chronological audit trail of all inventory transactions: Production, Sales, Returns, and Adjustments."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<Package size={16} />}
              onClick={() => navigate('/inventory')}
            >
              Current Balances
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="stock-filter-toolbar">
        <div className="toolbar-filters" style={{ width: '100%', justifyContent: 'flex-start' }}>
          <select
            className="filter-select"
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value as MovementType | '');
              setPage(1);
            }}
          >
            <option value="">All Movement Types</option>
            <option value="PRODUCTION_IN">Production In</option>
            <option value="SALE_OUT">Sale Out</option>
            <option value="SALES_RETURN_IN">Sales Return In</option>
            <option value="ADJUSTMENT_IN">Adjustment In (+)</option>
            <option value="ADJUSTMENT_OUT">Adjustment Out (-)</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              From:
            </span>
            <input
              type="date"
              className="filter-select"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              To:
            </span>
            <input
              type="date"
              className="filter-select"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {(movementType || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMovementType('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Movement Ledger DataTable */}
      <Card>
        {isLoading ? (
          <LoadingState message="Loading stock movement transactions..." />
        ) : error ? (
          <ErrorState
            title="Error Loading Ledger"
            message={error}
            onRetry={fetchMovements}
          />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight size={48} />}
            title="No Movements Recorded"
            description="No stock movements match the selected filters."
          />
        ) : (
          <>
            <DataTable data={movements} columns={columns} keyExtractor={(row) => row.id} />
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
