import React, { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ArrowLeftRight,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Eye,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Modal } from '../../components/ui/Modal/Modal';
import { Drawer } from '../../components/ui/Drawer/Drawer';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import {
  inventoryApi,
  StockItem,
  InventorySummary,
  ProductStockDetail,
  ReconcileStockResponse,
  StockMovement,
} from './inventory.api';
import { CategoriesApi, Category } from '../categories/categories.api';
import { formatDate, formatDateTime, formatGramsToKg, formatDeltaWeight } from '../../utils/formatters';
import './StockPage.css';

export const StockPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();

  const isAdmin = user?.role === 'ADMIN';

  // Form control IDs
  const adjustProductSelectId = useId();
  const adjustQtyInputId = useId();
  const adjustReasonInputId = useId();
  const adjustNotesTextareaId = useId();

  // State
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockTab, setStockTab] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Product Stock Detail Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProductStock, setSelectedProductStock] = useState<ProductStockDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [productMovements, setProductMovements] = useState<StockMovement[]>([]);

  // Manual Stock Adjustment Modal (Admin only)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [adjustQuantity, setAdjustQuantity] = useState<number | ''>('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Stock Reconciliation Modal (Admin only)
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileStockResponse | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Load Inventory Summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await inventoryApi.getSummary();
      setSummary(data);
    } catch (err: any) {
      console.warn('Failed to load inventory summary:', err);
    }
  }, []);

  // Load Categories for filter
  const fetchCategories = useCallback(async () => {
    try {
      const list = await CategoriesApi.list({ status: 'active' });
      setCategories(list || []);
    } catch (err: any) {
      console.warn('Failed to load categories:', err);
    }
  }, []);

  // Load Stock Table Data
  const fetchStocks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryApi.listStock({
        search: search.trim() || undefined,
        categoryId: categoryId || undefined,
        lowStockOnly: stockTab === 'LOW' ? true : undefined,
        outOfStockOnly: stockTab === 'OUT' ? true : undefined,
        page,
        limit,
      });

      setStocks(res.items || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory balances');
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryId, stockTab, page, limit]);

  useEffect(() => {
    fetchSummary();
    fetchCategories();
  }, [fetchSummary, fetchCategories]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  // Open Product Stock Detail Drawer
  const handleOpenDrawer = async (productId: string) => {
    setIsDrawerOpen(true);
    setDrawerLoading(true);
    setSelectedProductStock(null);
    setProductMovements([]);
    try {
      const [detail, movRes] = await Promise.all([
        inventoryApi.getProductStock(productId),
        inventoryApi.listMovements({ productId, limit: 10 }),
      ]);
      setSelectedProductStock(detail);
      setProductMovements(movRes.items || []);
    } catch (err: any) {
      showError(err.message || 'Failed to load product stock breakdown');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Open Manual Stock Adjustment Modal
  const handleOpenAdjustModal = (product?: StockItem) => {
    setAdjustProductId(product ? product.productId : stocks[0]?.productId || '');
    setAdjustDirection('INCREASE');
    setAdjustQuantity('');
    setAdjustReason('');
    setAdjustNotes('');
    setIsAdjustModalOpen(true);
  };

  // Submit Manual Stock Adjustment
  const handleSubmitAdjustment = async () => {
    if (!adjustProductId) {
      showError('Please select a product');
      return;
    }
    if (!adjustQuantity || Number(adjustQuantity) <= 0) {
      showError('Adjustment quantity must be greater than zero');
      return;
    }
    if (!adjustReason.trim() || adjustReason.trim().length < 3) {
      showError('A clear adjustment reason (minimum 3 characters) is required');
      return;
    }

    const signedDelta =
      adjustDirection === 'INCREASE' ? Number(adjustQuantity) : -Math.abs(Number(adjustQuantity));

    setIsAdjusting(true);
    try {
      await inventoryApi.adjustStock({
        productId: adjustProductId,
        quantityDelta: signedDelta,
        reason: adjustReason.trim(),
        notes: adjustNotes.trim() || undefined,
      });

      showSuccess('Manual stock adjustment applied and recorded in movement ledger');
      setIsAdjustModalOpen(false);
      fetchSummary();
      fetchStocks();
      if (isDrawerOpen && selectedProductStock?.productId === adjustProductId) {
        handleOpenDrawer(adjustProductId);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to adjust stock balance');
    } finally {
      setIsAdjusting(false);
    }
  };

  // Open Reconciliation Modal
  const handleOpenReconcileModal = async (productId: string) => {
    setIsReconciling(true);
    setIsReconcileModalOpen(true);
    setReconcileResult(null);
    try {
      const data = await inventoryApi.reconcileStock(productId);
      setReconcileResult(data);
    } catch (err: any) {
      showError(err.message || 'Failed to reconcile stock');
      setIsReconcileModalOpen(false);
    } finally {
      setIsReconciling(false);
    }
  };

  const selectedProductForAdjust = stocks.find((s) => s.productId === adjustProductId);

  // Table Columns
  const columns: ColumnDef<StockItem>[] = [
    {
      header: 'Product Name',
      key: 'productName',
      cell: (row) => (
        <div className="product-cell">
          <span
            className="product-name-en"
            style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
            onClick={() => handleOpenDrawer(row.productId)}
            title="Click to view full inventory history"
          >
            {row.productName}
          </span>
          <span className="product-code-sub">Code: {row.productCode}</span>
        </div>
      ),
    },
    {
      header: 'Category / Subcategory',
      key: 'categoryName',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {row.categoryName} / {row.subcategoryName}
        </span>
      ),
    },
    {
      header: 'Current Balance',
      key: 'currentBalance',
      cell: (row) => {
        const statusClass = row.isOutOfStock
          ? 'out-of-stock'
          : row.isLowStock
          ? 'low-stock'
          : 'in-stock';

        return (
          <div className="stock-balance-cell">
            <span className={`stock-balance-value ${statusClass}`}>
              {formatGramsToKg(row.currentBalance)}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Min. Threshold',
      key: 'minimumThreshold',
      cell: (row) => (
        <span className="threshold-indicator">
          {formatGramsToKg(row.minimumThreshold)}
        </span>
      ),
    },
    {
      header: 'Stock Status',
      key: 'status',
      cell: (row) => {
        if (row.isOutOfStock) {
          return <Badge variant="danger">Out of Stock</Badge>;
        }
        if (row.isLowStock) {
          return <Badge variant="warning">Low Stock</Badge>;
        }
        return <Badge variant="success">In Stock</Badge>;
      },
    },
    {
      header: 'Last Updated',
      key: 'lastUpdatedAt',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {formatDate(row.lastUpdatedAt)}
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
            onClick={() => handleOpenDrawer(row.productId)}
            title="View Stock Breakdown & Ledger"
          >
            <Eye size={18} />
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                className="pos-table-action-btn pos-action-btn-edit"
                onClick={() => handleOpenAdjustModal(row)}
                title="Manual Stock Adjustment (Admin)"
              >
                <SlidersHorizontal size={18} />
              </button>
              <button
                type="button"
                className="pos-table-action-btn pos-action-btn-print"
                onClick={() => handleOpenReconcileModal(row.productId)}
                title="Reconcile Ledger Balance (Admin)"
              >
                <ShieldCheck size={18} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="module-shell-page stock-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Inventory & Stock' },
        ]}
      />

      <PageHeader
        title="Stock & Inventory Status"
        subtitle="Real-time stock balances across all product packs, threshold breach alerts, and ledger reconciliation."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<ArrowLeftRight size={16} />}
              onClick={() => navigate('/inventory/movements')}
            >
              Movement Ledger
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                leftIcon={<SlidersHorizontal size={16} />}
                onClick={() => handleOpenAdjustModal()}
              >
                Stock Adjustment
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="stock-kpis">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper primary">
            <Package size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Active Products</span>
            <span className="kpi-value">{summary?.totalActiveProducts ?? 0}</span>
            <span className="kpi-subtext">Catalog items tracked</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper success">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">In Stock</span>
            <span className="kpi-value">{summary?.inStockCount ?? 0}</span>
            <span className="kpi-subtext">Healthy inventory level</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper warning">
            <TrendingDown size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Low Stock Alerts</span>
            <span className="kpi-value">{summary?.lowStockCount ?? 0}</span>
            <span className="kpi-subtext">Below min. threshold</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper error">
            <XCircle size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Out of Stock</span>
            <span className="kpi-value">{summary?.outOfStockCount ?? 0}</span>
            <span className="kpi-subtext">Requires replenishment</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="stock-filter-toolbar">
        <div className="filter-tabs-group">
          <button
            className={`filter-tab-btn ${stockTab === 'ALL' ? 'active' : ''}`}
            onClick={() => {
              setStockTab('ALL');
              setPage(1);
            }}
          >
            All Products
          </button>
          <button
            className={`filter-tab-btn ${stockTab === 'LOW' ? 'active' : ''}`}
            onClick={() => {
              setStockTab('LOW');
              setPage(1);
            }}
          >
            Low Stock ({summary?.lowStockCount ?? 0})
          </button>
          <button
            className={`filter-tab-btn ${stockTab === 'OUT' ? 'active' : ''}`}
            onClick={() => {
              setStockTab('OUT');
              setPage(1);
            }}
          >
            Out of Stock ({summary?.outOfStockCount ?? 0})
          </button>
        </div>

        <div className="toolbar-filters">
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', paddingLeft: '32px' }}
              placeholder="Search product or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="filter-select"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {(search || categoryId || stockTab !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategoryId('');
                setStockTab('ALL');
                setPage(1);
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Stock DataTable */}
      <Card>
        {isLoading ? (
          <LoadingState message="Loading inventory balances..." />
        ) : error ? (
          <ErrorState
            title="Error Loading Inventory"
            message={error}
            onRetry={fetchStocks}
          />
        ) : stocks.length === 0 ? (
          <EmptyState
            icon={<Package size={48} />}
            title="No Products Found in Inventory"
            description={
              search || categoryId || stockTab !== 'ALL'
                ? 'No inventory items match the selected criteria.'
                : 'No products are registered in the inventory yet.'
            }
          />
        ) : (
          <>
            <DataTable data={stocks} columns={columns} keyExtractor={(row) => row.id} />
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

      {/* DRAWER: Product Stock Detail & Recent Ledger */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={
          selectedProductStock
            ? `${selectedProductStock.productName} — Inventory Details`
            : 'Product Stock Details'
        }
        position="right"
        size="lg"
      >
        {drawerLoading ? (
          <LoadingState message="Loading product stock breakdown..." />
        ) : selectedProductStock ? (
          <div className="drawer-content-stack">
            {/* Overview Metric Tiles */}
            <div className="stock-overview-grid">
              <div className="stock-metric-tile">
                <span className="metric-tile-title">Current Balance</span>
                <span
                  className="metric-tile-number"
                  style={{
                    color: selectedProductStock.isOutOfStock
                      ? 'var(--color-error)'
                      : selectedProductStock.isLowStock
                      ? 'var(--color-warning)'
                      : 'var(--color-success)',
                  }}
                >
                  {formatGramsToKg(selectedProductStock.currentBalance)}
                </span>
              </div>

              <div className="stock-metric-tile">
                <span className="metric-tile-title">Minimum Threshold</span>
                <span className="metric-tile-number" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatGramsToKg(selectedProductStock.minimumThreshold)}
                </span>
              </div>
            </div>

            {/* Threshold Status Banner */}
            {selectedProductStock.isOutOfStock ? (
              <div className="alert-box danger">
                <XCircle size={18} />
                <div>
                  <strong>Out of Stock</strong>: Immediate replenishment or production run
                  recommended.
                </div>
              </div>
            ) : selectedProductStock.isLowStock ? (
              <div className="alert-box warning">
                <AlertTriangle size={18} />
                <div>
                  <strong>Low Stock Warning</strong>: Balance is at or below the safety threshold of{' '}
                  {formatGramsToKg(selectedProductStock.minimumThreshold)}.
                </div>
              </div>
            ) : (
              <div className="alert-box info">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Adequate Stock</strong>: Current balance exceeds minimum safety
                  threshold.
                </div>
              </div>
            )}

            {/* Product Meta Card */}
            <Card title="Product Specifications">
              <div className="detail-card-section">
                <div className="detail-row">
                  <span className="detail-label">Product Code</span>
                  <span className="detail-value">{selectedProductStock.productCode}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Category / Subcategory</span>
                  <span className="detail-value">
                    {selectedProductStock.categoryName} / {selectedProductStock.subcategoryName}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Base Unit</span>
                  <span className="detail-value">{selectedProductStock.unitSymbol}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Weight-Based</span>
                  <span className="detail-value">
                    {selectedProductStock.isWeightBased ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick Actions (Admin) */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<SlidersHorizontal size={14} />}
                  onClick={() => {
                    const item = stocks.find(
                      (s) => s.productId === selectedProductStock.productId
                    );
                    handleOpenAdjustModal(item);
                  }}
                >
                  Adjust Balance
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ShieldCheck size={14} />}
                  onClick={() => handleOpenReconcileModal(selectedProductStock.productId)}
                >
                  Audit Reconciliation
                </Button>
              </div>
            )}

            {/* Recent Movement History */}
            <Card title="Recent Stock Movements (Ledger)">
              {productMovements.length === 0 ? (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  No recorded stock movements for this product.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {productMovements.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: 'var(--color-surface-hover, #f9fafb)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {m.movementType.replace('_', ' ')}
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {formatDateTime(m.createdAt)} {m.notes ? `• ${m.notes}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              m.quantityDelta > 0 ? 'var(--color-success)' : 'var(--color-error)',
                            fontSize: 'var(--font-size-sm)',
                          }}
                        >
                          {formatDeltaWeight(m.quantityDelta)}
                        </span>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Bal: {formatGramsToKg(m.balanceAfter)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </Drawer>

      {/* MODAL: Manual Stock Adjustment (Admin Only) */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => !isAdjusting && setIsAdjustModalOpen(false)}
        title="Manual Stock Adjustment"
        size="md"
      >
        <div className="production-form">
          <div className="alert-box warning">
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Audited Administrator Action</strong>
              <p style={{ marginTop: '2px' }}>
                Manual adjustments append an immutable entry to the stock movement ledger and update
                the product's cached balance.
              </p>
            </div>
          </div>

          {/* Product Picker */}
          <div className="form-group">
            <label className="form-label">Product to Adjust</label>
            <select
              className="form-input"
              value={adjustProductId}
              onChange={(e) => setAdjustProductId(e.target.value)}
              disabled={isAdjusting}
            >
              {stocks.map((s) => (
                <option key={s.productId} value={s.productId}>
                  {s.productName} [{s.productCode}] — Current: {formatGramsToKg(s.currentBalance)}
                </option>
              ))}
            </select>
          </div>

          {selectedProductForAdjust && (
            <div className="product-picker-preview">
              <span>
                Current Balance: <strong>{formatGramsToKg(selectedProductForAdjust.currentBalance)}</strong>
              </span>
              <span>
                Min Threshold: <strong>{formatGramsToKg(selectedProductForAdjust.minimumThreshold)}</strong>
              </span>
            </div>
          )}

          {/* Adjustment Direction Toggle */}
          <div className="form-group">
            <label className="form-label">Adjustment Type</label>
            <div className="adjustment-direction-toggle">
              <button
                type="button"
                className={`toggle-btn increase ${adjustDirection === 'INCREASE' ? 'active' : ''}`}
                onClick={() => setAdjustDirection('INCREASE')}
                disabled={isAdjusting}
              >
                <TrendingUp size={16} /> Add Stock (+)
              </button>
              <button
                type="button"
                className={`toggle-btn decrease ${adjustDirection === 'DECREASE' ? 'active' : ''}`}
                onClick={() => setAdjustDirection('DECREASE')}
                disabled={isAdjusting}
              >
                <TrendingDown size={16} /> Deduct / Damage (-)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={adjustQtyInputId}>
              Adjustment Quantity ({selectedProductForAdjust?.unitSymbol || 'units'}){' '}
              <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id={adjustQtyInputId}
              type="number"
              min="0.01"
              step="any"
              className="form-input"
              placeholder="Enter positive quantity"
              value={adjustQuantity}
              onChange={(e) =>
                setAdjustQuantity(e.target.value === '' ? '' : Number(e.target.value))
              }
              disabled={isAdjusting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={adjustReasonInputId}>
              Reason for Adjustment <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id={adjustReasonInputId}
              type="text"
              className="form-input"
              placeholder="e.g. Physical inventory count correction, Spoilage, Damage"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              disabled={isAdjusting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={adjustNotesTextareaId}>
              Internal Notes (Optional)
            </label>
            <textarea
              id={adjustNotesTextareaId}
              rows={2}
              className="form-textarea"
              placeholder="Additional remarks or incident report ID..."
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              disabled={isAdjusting}
            />
          </div>

          <div className="modal-action-footer">
            <Button
              variant="secondary"
              onClick={() => setIsAdjustModalOpen(false)}
              disabled={isAdjusting}
            >
              Cancel
            </Button>
            <Button
              variant={adjustDirection === 'INCREASE' ? 'primary' : 'danger'}
              onClick={handleSubmitAdjustment}
              isLoading={isAdjusting}
              disabled={!adjustQuantity || !adjustReason.trim() || adjustReason.trim().length < 3}
            >
              Apply Adjustment
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Stock Reconciliation Audit (Admin Only) */}
      <Modal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        title="Stock Balance Reconciliation Audit"
        size="md"
      >
        {isReconciling ? (
          <LoadingState message="Auditing stock ledger parity..." />
        ) : reconcileResult ? (
          <div className="reconcile-result-card">
            {reconcileResult.isConsistent ? (
              <div className="reconcile-status-banner consistent">
                <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>100% Invariant Parity Confirmed</h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)' }}>
                    Cached stock balance exactly equals the sum of all historical stock movement
                    transactions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="reconcile-status-banner discrepancy">
                <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Discrepancy Detected</h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)' }}>
                    Delta of {reconcileResult.discrepancy} detected between ledger sum and cached
                    balance.
                  </p>
                </div>
              </div>
            )}

            <div className="reconcile-comparison-grid">
              <div className="reconcile-metric">
                <span className="reconcile-metric-label">Cached Stock Balance</span>
                <span className="reconcile-metric-value" style={{ color: 'var(--color-primary)' }}>
                  {reconcileResult.cachedBalance.toLocaleString()}
                </span>
              </div>
              <div className="reconcile-metric">
                <span className="reconcile-metric-label">Ledger Sum Total</span>
                <span className="reconcile-metric-value" style={{ color: 'var(--color-success)' }}>
                  {reconcileResult.ledgerTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">Product Name</span>
              <span className="detail-value">{reconcileResult.productName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Product ID</span>
              <span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                {reconcileResult.productId}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Mathematical Delta</span>
              <span className="detail-value">{reconcileResult.discrepancy}</span>
            </div>

            <div className="modal-action-footer">
              <Button variant="secondary" onClick={() => setIsReconcileModalOpen(false)}>
                Close Audit
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
