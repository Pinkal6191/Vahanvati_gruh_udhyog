import React, { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChefHat,
  PlusCircle,
  History,
  CheckCircle2,
  Clock,
  Ban,
  TrendingUp,
  Search,
  Eye,
  Edit2,
  XCircle,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Modal } from '../../components/ui/Modal/Modal';
import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog/ConfirmationDialog';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { useToast } from '../../hooks/useToast';
import {
  productionApi,
  ProductionEntry,
  ProductionSummary,
  ProductionStatus,
  CreateProductionPayload,
  UpdateProductionPayload,
} from './production.api';
import { ProductsApi, Product, Unit } from '../products/products.api';
import { formatDate, formatGramsToKg } from '../../utils/formatters';
import './ProductionPage.css';

export const ProductionPage: React.FC = () => {
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();

  // Unique IDs for form controls
  const addProductSelectId = useId();
  const addQtyInputId = useId();
  const addUnitSelectId = useId();
  const addBatchInputId = useId();
  const addProdDateInputId = useId();
  const addExpDateInputId = useId();
  const addNotesTextareaId = useId();

  const editQtyInputId = useId();
  const editUnitSelectId = useId();
  const editBatchInputId = useId();
  const editProdDateInputId = useId();
  const editExpDateInputId = useId();
  const editNotesTextareaId = useId();

  const cancelReasonTextareaId = useId();

  // Summary & Table state
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductionStatus | ''>('');
  const [dateFilter, setDateFilter] = useState('');

  // Catalog items for form
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Add Production Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState<{
    productId: string;
    quantityProduced: number | '';
    unitId: string;
    batchNumber: string;
    productionDate: string;
    expiryDate: string;
    notes: string;
  }>({
    productId: '',
    quantityProduced: '',
    unitId: '',
    batchNumber: '',
    productionDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    notes: '',
  });

  // Edit Draft Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<ProductionEntry | null>(null);
  const [editForm, setEditForm] = useState<{
    quantityProduced: number | '';
    unitId: string;
    batchNumber: string;
    productionDate: string;
    expiryDate: string;
    notes: string;
  }>({
    quantityProduced: '',
    unitId: '',
    batchNumber: '',
    productionDate: '',
    expiryDate: '',
    notes: '',
  });

  // Complete Confirmation Dialog State
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [completingEntry, setCompletingEntry] = useState<ProductionEntry | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingEntry, setCancellingEntry] = useState<ProductionEntry | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Auto-generate batch code
  const generateBatchNumber = (productCode?: string) => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const prefix = productCode ? productCode.toUpperCase().slice(0, 4) : 'BATCH';
    return `${prefix}-${todayStr}-${rand}`;
  };

  // Fetch Summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await productionApi.getSummary();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load production summary:', err);
    }
  }, []);

  // Fetch Production Entries
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productionApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        date: dateFilter || undefined,
        page,
        limit,
      } as any);

      setEntries(res.items || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load production entries');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, dateFilter, page, limit]);

  // Load Catalog & Units for form selections
  const loadFormData = useCallback(async () => {
    try {
      const [prodRes, unitList] = await Promise.all([
        ProductsApi.list({ status: 'active', limit: 100 }),
        ProductsApi.fetchUnits(),
      ]);
      setProducts(prodRes.items || []);
      const sortedUnits = (unitList || []).sort((a, b) => {
        if (a.symbol === 'kg') return -1;
        if (b.symbol === 'kg') return 1;
        return 0;
      });
      setUnits(sortedUnits);
    } catch (err: any) {
      console.warn('Failed to load products/units for production form:', err);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    loadFormData();
  }, [fetchSummary, loadFormData]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Handle open Add Modal
  const handleOpenAddModal = () => {
    const defaultDate = new Date().toISOString().slice(0, 10);
    const defaultBatch = generateBatchNumber();
    setAddForm({
      productId: '',
      quantityProduced: '',
      unitId: units[0]?.id || '',
      batchNumber: defaultBatch,
      productionDate: defaultDate,
      expiryDate: '',
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  // Handle product select change in Add Form
  const handleProductSelect = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setAddForm((prev) => ({
      ...prev,
      productId,
      unitId: prod?.primaryUnitId || prev.unitId || units[0]?.id || '',
      batchNumber: generateBatchNumber(prod?.code),
    }));
  };

  // Handle Submit Add Production
  const handleSubmitAdd = async (status: 'DRAFT' | 'COMPLETED') => {
    if (!addForm.productId) {
      showError('Please select a manufactured product');
      return;
    }
    if (!addForm.quantityProduced || Number(addForm.quantityProduced) <= 0) {
      showError('Please enter a valid quantity produced (> 0)');
      return;
    }
    if (!addForm.unitId) {
      showError('Please select a measurement unit');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateProductionPayload = {
        productId: addForm.productId,
        quantityProduced: Number(addForm.quantityProduced),
        unitId: addForm.unitId,
        batchNumber: addForm.batchNumber.trim() || undefined,
        productionDate: addForm.productionDate,
        expiryDate: addForm.expiryDate ? addForm.expiryDate : undefined,
        notes: addForm.notes.trim() || undefined,
        status,
      };

      await productionApi.create(payload);
      showSuccess(
        status === 'COMPLETED'
          ? 'Production batch completed and inventory balance updated!'
          : 'Production draft logged successfully!'
      );
      setIsAddModalOpen(false);
      fetchSummary();
      fetchEntries();
    } catch (err: any) {
      showError(err.message || 'Failed to record production');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Edit Draft Modal
  const handleOpenEditModal = (entry: ProductionEntry) => {
    setEditingDraft(entry);
    setEditForm({
      quantityProduced: entry.quantityProduced,
      unitId: entry.unitId,
      batchNumber: entry.batchNumber,
      productionDate: entry.productionDate.slice(0, 10),
      expiryDate: entry.expiryDate ? entry.expiryDate.slice(0, 10) : '',
      notes: entry.notes || '',
    });
    setIsEditModalOpen(true);
  };

  // Handle Submit Edit Draft
  const handleSubmitEditDraft = async () => {
    if (!editingDraft) return;
    if (!editForm.quantityProduced || Number(editForm.quantityProduced) <= 0) {
      showError('Quantity must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: UpdateProductionPayload = {
        quantityProduced: Number(editForm.quantityProduced),
        unitId: editForm.unitId,
        batchNumber: editForm.batchNumber.trim() || undefined,
        productionDate: editForm.productionDate,
        expiryDate: editForm.expiryDate || undefined,
        notes: editForm.notes.trim() || undefined,
      };

      await productionApi.updateDraft(editingDraft.id, payload);
      showSuccess('Production draft updated successfully');
      setIsEditModalOpen(false);
      setEditingDraft(null);
      fetchEntries();
      fetchSummary();
    } catch (err: any) {
      showError(err.message || 'Failed to update production draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Complete Draft
  const handleConfirmComplete = async () => {
    if (!completingEntry) return;
    setIsCompleting(true);
    try {
      await productionApi.completeDraft(completingEntry.id);
      showSuccess(
        `Batch ${completingEntry.batchNumber} marked COMPLETED. Stock automatically added to inventory!`
      );
      setIsCompleteDialogOpen(false);
      setCompletingEntry(null);
      fetchSummary();
      fetchEntries();
    } catch (err: any) {
      showError(err.message || 'Failed to complete production run');
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle Cancel Entry
  const handleConfirmCancel = async () => {
    if (!cancellingEntry) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      showError('Please enter a cancellation reason (at least 3 characters)');
      return;
    }

    setIsCancelling(true);
    try {
      await productionApi.cancel(cancellingEntry.id, cancelReason.trim());
      showSuccess(
        cancellingEntry.status === 'COMPLETED'
          ? `Batch ${cancellingEntry.batchNumber} cancelled. Finished goods stock automatically reversed!`
          : `Batch ${cancellingEntry.batchNumber} draft cancelled.`
      );
      setIsCancelModalOpen(false);
      setCancellingEntry(null);
      setCancelReason('');
      fetchSummary();
      fetchEntries();
    } catch (err: any) {
      showError(err.message || 'Failed to cancel production entry');
    } finally {
      setIsCancelling(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: ProductionStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // DataTable Columns
  const columns: ColumnDef<ProductionEntry>[] = [
    {
      header: 'Batch Number',
      key: 'batchNumber',
      cell: (row) => (
        <span
          className="batch-number-badge"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/production/${row.id}`)}
          title="Click to view full batch details"
        >
          {row.batchNumber}
        </span>
      ),
    },
    {
      header: 'Date',
      key: 'productionDate',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>
          {formatDate(row.productionDate)}
        </span>
      ),
    },
    {
      header: 'Product',
      key: 'product',
      cell: (row) => {
        const name = row.product?.name || (row as any).productName || 'Unknown Product';
        const gujarati = row.product?.gujaratiName || (row as any).productGujaratiName;
        const code = row.product?.code || (row as any).productCode || '-';
        return (
          <div className="product-cell">
            <span className="product-name-en">{name}</span>
            {gujarati && <span className="product-name-gu">{gujarati}</span>}
            <span className="product-code-sub">Code: {code}</span>
          </div>
        );
      },
    },
    {
      header: 'Quantity Output',
      key: 'quantityProduced',
      cell: (row) => {
        const symbol = row.unit?.symbol || (row as any).unitSymbol || 'kg';
        return (
          <div className="quantity-cell">
            <span className="quantity-value">{row.quantityProduced}</span>
            <span className="quantity-unit">{symbol}</span>
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      cell: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Logged By',
      key: 'user',
      cell: (row) => {
        const loggedBy =
          row.user?.fullName ||
          row.user?.username ||
          (row as any).createdBy?.fullName ||
          (row as any).createdByName ||
          'System';
        return (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {loggedBy}
          </span>
        );
      },
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

          {row.status === 'DRAFT' && (
            <>
              <button
                type="button"
                className="pos-table-action-btn pos-action-btn-edit"
                onClick={() => handleOpenEditModal(row)}
                title="Edit Draft"
              >
                <Edit2 size={18} />
              </button>
              <button
                type="button"
                className="pos-table-action-btn pos-action-btn-complete"
                onClick={() => {
                  setCompletingEntry(row);
                  setIsCompleteDialogOpen(true);
                }}
                title="Complete and add to stock"
              >
                <CheckCircle2 size={18} /> Complete
              </button>
            </>
          )}

          {row.status !== 'CANCELLED' && (
            <button
              type="button"
              className="pos-table-action-btn pos-action-btn-cancel"
              onClick={() => {
                setCancellingEntry(row);
                setCancelReason('');
                setIsCancelModalOpen(true);
              }}
              title="Cancel Batch Entry"
            >
              <XCircle size={18} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const selectedProductInfo = products.find((p) => p.id === addForm.productId);

  return (
    <div className="module-shell-page production-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Production Management' },
        ]}
      />

      <PageHeader
        title="Production Entry & Batches"
        subtitle="Record manufactured goods, manage production drafts, auto-generate batch codes, and auto-increment stock balances."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<History size={16} />}
              onClick={() => navigate('/production/history')}
            >
              Batch History
            </Button>
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              onClick={handleOpenAddModal}
            >
              Log Production Batch
            </Button>
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="production-kpis">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper primary">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Today's Output</span>
            <span className="kpi-value">
              {summary ? formatGramsToKg(summary.todayProductionWeightGrams) : '0 kg'}
            </span>
            <span className="kpi-subtext">Base unit weight</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper success">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Completed Batches</span>
            <span className="kpi-value">{summary?.completedCount ?? 0}</span>
            <span className="kpi-subtext">Active in inventory</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper warning">
            <Clock size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Open Drafts</span>
            <span className="kpi-value">{summary?.draftCount ?? 0}</span>
            <span className="kpi-subtext">Pending completion</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper error">
            <Ban size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Cancelled Runs</span>
            <span className="kpi-value">{summary?.cancelledCount ?? 0}</span>
            <span className="kpi-subtext">Reversed transactions</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper neutral">
            <ChefHat size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Logged</span>
            <span className="kpi-value">{summary?.totalEntries ?? 0}</span>
            <span className="kpi-subtext">All time production</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
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
              placeholder="Search by product name, batch #, or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="toolbar-filters">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ProductionStatus | '');
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <input
            type="date"
            className="filter-select"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            title="Filter by production date"
          />

          {(search || statusFilter || dateFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setDateFilter('');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Production Batches DataTable */}
      <Card>
        {isLoading ? (
          <LoadingState message="Loading production records..." />
        ) : error ? (
          <ErrorState
            title="Error Loading Production Batches"
            message={error}
            onRetry={fetchEntries}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<ChefHat size={48} />}
            title="No Production Batches Found"
            description={
              search || statusFilter || dateFilter
                ? 'No production entries match the selected filters. Try broadening your query.'
                : 'No production runs have been logged yet. Click "Log Production Batch" to start.'
            }
            action={
              search || statusFilter || dateFilter
                ? {
                    label: 'Clear Filters',
                    onClick: () => {
                      setSearch('');
                      setStatusFilter('');
                      setDateFilter('');
                      setPage(1);
                    },
                    variant: 'outline',
                  }
                : {
                    label: 'Log First Batch',
                    onClick: handleOpenAddModal,
                    variant: 'primary',
                  }
            }
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

      {/* MODAL: Log Production Batch */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="Log Production Batch"
        size="lg"
      >
        <div className="production-form">
          <div className="form-group">
            <label className="form-label" htmlFor={addProductSelectId}>
              Manufactured Product <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select
              id={addProductSelectId}
              className="form-select"
              value={addForm.productId}
              onChange={(e) => handleProductSelect(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Select a product to manufacture...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gujaratiName ? `(${p.gujaratiName})` : ''} — [{p.code}]
                </option>
              ))}
            </select>
          </div>

          {selectedProductInfo && (
            <div className="product-picker-preview">
              <span>
                <strong>Category:</strong> {selectedProductInfo.subcategory?.name || 'General'}
              </span>
              <span>
                <strong>Current Stock:</strong>{' '}
                {selectedProductInfo.stock?.currentBalance ?? 0}{' '}
                {selectedProductInfo.primaryUnit?.symbol || 'gm'}
              </span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor={addQtyInputId}>
                Quantity Produced <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                id={addQtyInputId}
                type="number"
                min="0.01"
                step="any"
                className="form-input"
                placeholder="e.g. 25 or 50000"
                value={addForm.quantityProduced}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    quantityProduced: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={addUnitSelectId}>
                Measurement Unit <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                id={addUnitSelectId}
                className="form-select"
                value={addForm.unitId}
                onChange={(e) => setAddForm((prev) => ({ ...prev, unitId: e.target.value }))}
                disabled={isSubmitting}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={addBatchInputId}>
              Batch Number / Code <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div className="batch-input-row">
              <input
                id={addBatchInputId}
                type="text"
                className="form-input"
                value={addForm.batchNumber}
                onChange={(e) => setAddForm((prev) => ({ ...prev, batchNumber: e.target.value }))}
                disabled={isSubmitting}
              />
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  setAddForm((prev) => ({
                    ...prev,
                    batchNumber: generateBatchNumber(selectedProductInfo?.code),
                  }))
                }
                leftIcon={<Sparkles size={14} />}
                disabled={isSubmitting}
                title="Generate new batch code"
              >
                Regenerate
              </Button>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor={addProdDateInputId}>
                Production Date <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                id={addProdDateInputId}
                type="date"
                className="form-input"
                value={addForm.productionDate}
                onChange={(e) => setAddForm((prev) => ({ ...prev, productionDate: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={addExpDateInputId}>
                Expiry Date (Optional)
              </label>
              <input
                id={addExpDateInputId}
                type="date"
                className="form-input"
                value={addForm.expiryDate}
                onChange={(e) => setAddForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={addNotesTextareaId}>
              Notes / Production Remarks
            </label>
            <textarea
              id={addNotesTextareaId}
              rows={2}
              className="form-textarea"
              placeholder="e.g. Batch temperature 180°C, fresh batch for festival rush..."
              value={addForm.notes}
              onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="modal-action-footer">
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmitAdd('DRAFT')}
              isLoading={isSubmitting}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              onClick={() => handleSubmitAdd('COMPLETED')}
              isLoading={isSubmitting}
              leftIcon={<CheckCircle2 size={16} />}
            >
              Complete & Add to Stock
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Edit Production Draft */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title={`Edit Draft Batch — ${editingDraft?.batchNumber || ''}`}
        size="md"
      >
        <div className="production-form">
          <div className="alert-box info">
            <span>
              Editing draft for <strong>{editingDraft?.product?.name}</strong>. Stock will only be
              updated upon completion.
            </span>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor={editQtyInputId}>
                Quantity Produced <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                id={editQtyInputId}
                type="number"
                min="0.01"
                step="any"
                className="form-input"
                value={editForm.quantityProduced}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    quantityProduced: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={editUnitSelectId}>
                Measurement Unit
              </label>
              <select
                id={editUnitSelectId}
                className="form-select"
                value={editForm.unitId}
                onChange={(e) => setEditForm((prev) => ({ ...prev, unitId: e.target.value }))}
                disabled={isSubmitting}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={editBatchInputId}>
              Batch Code
            </label>
            <input
              id={editBatchInputId}
              type="text"
              className="form-input"
              value={editForm.batchNumber}
              onChange={(e) => setEditForm((prev) => ({ ...prev, batchNumber: e.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor={editProdDateInputId}>
                Production Date
              </label>
              <input
                id={editProdDateInputId}
                type="date"
                className="form-input"
                value={editForm.productionDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, productionDate: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={editExpDateInputId}>
                Expiry Date (Optional)
              </label>
              <input
                id={editExpDateInputId}
                type="date"
                className="form-input"
                value={editForm.expiryDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={editNotesTextareaId}>
              Notes
            </label>
            <textarea
              id={editNotesTextareaId}
              rows={2}
              className="form-textarea"
              value={editForm.notes}
              onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="modal-action-footer">
            <Button
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmitEditDraft} isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* DIALOG: Complete Production Draft */}
      <ConfirmationDialog
        isOpen={isCompleteDialogOpen}
        onClose={() => !isCompleting && setIsCompleteDialogOpen(false)}
        onConfirm={handleConfirmComplete}
        title="Complete Production Batch"
        variant="primary"
        isLoading={isCompleting}
        confirmText="Confirm & Add Stock"
        message={
          <div>
            <p>
              Are you sure you want to finalize batch{' '}
              <strong>{completingEntry?.batchNumber}</strong>?
            </p>
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-success)',
              }}
            >
              This will automatically credit{' '}
              <strong>
                {completingEntry?.quantityProduced} {completingEntry?.unit?.symbol}
              </strong>{' '}
              into inventory for product{' '}
              <strong>{completingEntry?.product?.name}</strong>.
            </div>
          </div>
        }
      />

      {/* MODAL: Cancel Production Entry */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => !isCancelling && setIsCancelModalOpen(false)}
        title={`Cancel Production Entry — ${cancellingEntry?.batchNumber || ''}`}
        size="md"
      >
        <div className="production-form">
          {cancellingEntry?.status === 'COMPLETED' ? (
            <div className="alert-box danger">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Warning: Stock Reversal</strong>
                <p style={{ marginTop: '2px' }}>
                  This batch was previously completed. Cancelling it will immediately subtract{' '}
                  <strong>
                    {cancellingEntry.quantityProduced} {cancellingEntry.unit?.symbol}
                  </strong>{' '}
                  from current inventory!
                </p>
              </div>
            </div>
          ) : (
            <div className="alert-box warning">
              <p>
                Cancelling this draft will discard the production entry and mark its status as
                CANCELLED.
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor={cancelReasonTextareaId}>
              Cancellation Reason (Mandatory){' '}
              <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <textarea
              id={cancelReasonTextareaId}
              rows={3}
              className="form-textarea"
              placeholder="Provide a clear justification (minimum 3 characters)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={isCancelling}
            />
          </div>

          <div className="modal-action-footer">
            <Button
              variant="secondary"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCancelling}
            >
              Back
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              isLoading={isCancelling}
              disabled={!cancelReason.trim() || cancelReason.trim().length < 3}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
