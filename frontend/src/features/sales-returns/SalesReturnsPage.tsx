import React, { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  PlusCircle,
  History,
  CheckCircle2,
  Clock,
  Ban,
  Search,
  Eye,
  Edit2,
  XCircle,
  AlertTriangle,
  Receipt,
  Wallet,
  Coins,
  CreditCard,
  Layers,
  ArrowRight,
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
import { useAuth } from '../../hooks/useAuth';
import {
  salesReturnsApi,
  SalesReturn,
  ReturnSummary,
  ReturnStatus,
  RefundPaymentMode,
  RestockCondition,
  ReturnPreview,
  CreateReturnPayload,
  UpdateReturnPayload,
} from './sales-returns.api';
import { BillingApi, SaleRecord } from '../billing/billing.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import './SalesReturnsPage.css';

interface SelectedReturnItem {
  saleItemId: string;
  returnedQuantity: number;
  restockCondition: RestockCondition;
  unitRate: number;
  productName: string;
  unitSymbol: string;
  remainingReturnable: number;
}

export const SalesReturnsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();

  const canCreateReturn = user?.role === 'ADMIN' || user?.role === 'OUTLET';

  // Form IDs
  const searchBillInputId = useId();
  const returnReasonInputId = useId();
  const editReasonInputId = useId();
  const cancelReasonTextareaId = useId();

  // Summary & Table State
  const [summary, setSummary] = useState<ReturnSummary | null>(null);
  const [returnsList, setReturnsList] = useState<SalesReturn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New Return Modal & Wizard State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [recentBills, setRecentBills] = useState<SaleRecord[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [preview, setPreview] = useState<ReturnPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedReturnItem>>({});
  const [refundMode, setRefundMode] = useState<RefundPaymentMode>('CASH');
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Edit Draft Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<SalesReturn | null>(null);
  const [editReason, setEditReason] = useState('');
  const [editRefundMode, setEditRefundMode] = useState<RefundPaymentMode>('CASH');
  const [isUpdatingDraft, setIsUpdatingDraft] = useState(false);

  // Complete Dialog State
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [completingReturn, setCompletingReturn] = useState<SalesReturn | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingReturn, setCancellingReturn] = useState<SalesReturn | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch Summary Metrics
  const fetchSummary = useCallback(async () => {
    try {
      const data = await salesReturnsApi.getSummary();
      setSummary(data);
    } catch (err: any) {
      console.warn('Failed to fetch returns summary:', err);
    }
  }, []);

  // Fetch Returns Ledger
  const fetchReturns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await salesReturnsApi.list({
        returnNumber: search.trim().toUpperCase().startsWith('RET') ? search.trim() : undefined,
        originalBillNumber: !search.trim().toUpperCase().startsWith('RET') && search.trim() ? search.trim() : undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });

      setReturnsList(res.items || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sales returns ledger');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, startDate, endDate, page, limit]);

  // Fetch Recent Completed Bills for Quick Picker
  const fetchRecentBills = useCallback(async () => {
    setIsLoadingBills(true);
    try {
      const res = await BillingApi.listSales({ saleStatus: 'COMPLETED', limit: 8 });
      setRecentBills(res.items || []);
    } catch (err: any) {
      console.warn('Failed to load recent sales for return lookup:', err);
    } finally {
      setIsLoadingBills(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Open "New Return" Wizard
  const handleOpenAddModal = () => {
    setBillSearchQuery('');
    setPreview(null);
    setSelectedItems({});
    setRefundMode('CASH');
    setReturnReason('');
    setIsAddModalOpen(true);
    fetchRecentBills();
  };

  // Perform Bill Preview Lookup
  const handleLookupBill = async (billIdentifier: string) => {
    const queryToUse = billIdentifier.trim();
    if (!queryToUse) {
      showError('Please enter a valid bill number or invoice ID');
      return;
    }

    setIsLoadingPreview(true);
    setPreview(null);
    setSelectedItems({});
    try {
      const previewData = await salesReturnsApi.getPreview(queryToUse);
      setPreview(previewData);
      setBillSearchQuery(previewData.billNumber);
    } catch (err: any) {
      showError(err.message || `Sale #${queryToUse} not found or ineligible for returns`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Toggle item selection in return cart
  const handleToggleItem = (item: any) => {
    if (!item.isEligibleForReturn) return;

    setSelectedItems((prev) => {
      const updated = { ...prev };
      if (updated[item.saleItemId]) {
        delete updated[item.saleItemId];
      } else {
        updated[item.saleItemId] = {
          saleItemId: item.saleItemId,
          returnedQuantity: item.remainingReturnableQuantity,
          restockCondition: 'RESTOCKABLE',
          unitRate: item.unitRate,
          productName: item.productName,
          unitSymbol: item.unitSymbol,
          remainingReturnable: item.remainingReturnableQuantity,
        };
      }
      return updated;
    });
  };

  // Change returned quantity for selected item
  const handleQuantityChange = (saleItemId: string, newQty: number) => {
    setSelectedItems((prev) => {
      const item = prev[saleItemId];
      if (!item) return prev;
      const clamped = Math.max(0.01, Math.min(newQty, item.remainingReturnable));
      return {
        ...prev,
        [saleItemId]: {
          ...item,
          returnedQuantity: Math.round(clamped * 1000) / 1000,
        },
      };
    });
  };

  // Change restock condition for selected item
  const handleRestockConditionChange = (saleItemId: string, condition: RestockCondition) => {
    setSelectedItems((prev) => {
      const item = prev[saleItemId];
      if (!item) return prev;
      return {
        ...prev,
        [saleItemId]: {
          ...item,
          restockCondition: condition,
        },
      };
    });
  };

  // Calculate live return total
  const calculatedTotalRefund = Object.values(selectedItems).reduce(
    (sum, item) => sum + item.returnedQuantity * item.unitRate,
    0
  );

  // Submit New Sales Return
  const handleSubmitReturn = async (status: 'DRAFT' | 'COMPLETED') => {
    if (!preview) {
      showError('Please look up an original sale invoice first');
      return;
    }

    const itemsToSubmit = Object.values(selectedItems);
    if (itemsToSubmit.length === 0) {
      showError('Please select at least one item from the original bill to return');
      return;
    }

    if (!returnReason.trim() || returnReason.trim().length < 3) {
      showError('Please enter a clear return reason (minimum 3 characters)');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const payload: CreateReturnPayload = {
        originalSaleId: preview.originalSaleId,
        reason: returnReason.trim(),
        refundPaymentMode: refundMode,
        status,
        items: itemsToSubmit.map((i) => ({
          saleItemId: i.saleItemId,
          returnedQuantity: i.returnedQuantity,
          restockCondition: i.restockCondition,
        })),
      };

      const result = await salesReturnsApi.create(payload);
      showSuccess(
        status === 'COMPLETED'
          ? `Return #${result.returnNumber} completed! Inventory stock restored.`
          : `Return draft #${result.returnNumber} saved successfully.`
      );
      setIsAddModalOpen(false);
      fetchSummary();
      fetchReturns();
    } catch (err: any) {
      showError(err.message || 'Failed to process sales return');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Complete Draft Action
  const handleConfirmComplete = async () => {
    if (!completingReturn) return;
    setIsCompleting(true);
    try {
      await salesReturnsApi.complete(completingReturn.id);
      showSuccess(
        `Return #${completingReturn.returnNumber} marked COMPLETED. Stock restored to inventory!`
      );
      setIsCompleteDialogOpen(false);
      setCompletingReturn(null);
      fetchSummary();
      fetchReturns();
    } catch (err: any) {
      showError(err.message || 'Failed to finalize sales return');
    } finally {
      setIsCompleting(false);
    }
  };

  // Open Edit Draft Modal
  const handleOpenEditDraft = (record: SalesReturn) => {
    setEditingDraft(record);
    setEditReason(record.reason || '');
    setEditRefundMode(record.refundPaymentMode || 'CASH');
    setIsEditModalOpen(true);
  };

  // Submit Edit Draft
  const handleSaveEditDraft = async () => {
    if (!editingDraft) return;
    if (!editReason.trim() || editReason.trim().length < 3) {
      showError('Please provide a reason of at least 3 characters');
      return;
    }

    setIsUpdatingDraft(true);
    try {
      const payload: UpdateReturnPayload = {
        reason: editReason.trim(),
        refundPaymentMode: editRefundMode,
      };
      await salesReturnsApi.updateDraft(editingDraft.id, payload);
      showSuccess(`Return draft #${editingDraft.returnNumber} updated successfully`);
      setIsEditModalOpen(false);
      setEditingDraft(null);
      fetchReturns();
    } catch (err: any) {
      showError(err.message || 'Failed to update return draft');
    } finally {
      setIsUpdatingDraft(false);
    }
  };

  // Cancel Return Action
  const handleConfirmCancel = async () => {
    if (!cancellingReturn) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      showError('Please enter a cancellation reason (at least 3 characters)');
      return;
    }

    setIsCancelling(true);
    try {
      await salesReturnsApi.cancel(cancellingReturn.id, cancelReason.trim());
      showSuccess(
        cancellingReturn.status === 'COMPLETED'
          ? `Return #${cancellingReturn.returnNumber} cancelled. Restocked inventory automatically reversed!`
          : `Return draft #${cancellingReturn.returnNumber} cancelled.`
      );
      setIsCancelModalOpen(false);
      setCancellingReturn(null);
      setCancelReason('');
      fetchSummary();
      fetchReturns();
    } catch (err: any) {
      showError(err.message || 'Failed to cancel sales return');
    } finally {
      setIsCancelling(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: ReturnStatus) => {
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

  // Refund Mode Display Helper
  const renderRefundMode = (mode: RefundPaymentMode) => {
    switch (mode) {
      case 'CASH':
        return <span>Cash</span>;
      case 'UPI':
        return <span>UPI</span>;
      case 'STORE_CREDIT':
        return <span>Store Credit</span>;
      default:
        return <span>{mode}</span>;
    }
  };

  // Table Columns
  const columns: ColumnDef<SalesReturn>[] = [
    {
      header: 'Return Number',
      key: 'returnNumber',
      cell: (row) => (
        <span
          className="return-number-badge"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/sales-returns/${row.id}`)}
          title="Click to view full return document"
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
      header: 'Date & Time',
      key: 'createdAt',
      cell: (row) => (
        <span style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Customer',
      key: 'customerName',
      cell: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            {row.customerName || 'Walk-in Customer'}
          </span>
          {row.customerMobile && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {row.customerMobile}
            </span>
          )}
        </div>
      ),
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
      cell: (row) => renderRefundMode(row.refundPaymentMode),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Logged By',
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/sales-returns/${row.id}`)}
            title="View Return Details"
          >
            <Eye size={16} />
          </Button>

          {row.status === 'DRAFT' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEditDraft(row)}
                title="Edit Draft Details"
              >
                <Edit2 size={14} />
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCompletingReturn(row);
                  setIsCompleteDialogOpen(true);
                }}
                title="Complete return and restore stock"
              >
                <CheckCircle2 size={14} /> Complete
              </Button>
            </>
          )}

          {row.status !== 'CANCELLED' && (
            <Button
              variant="ghost"
              size="sm"
              style={{ color: 'var(--color-error)' }}
              onClick={() => {
                setCancellingReturn(row);
                setCancelReason('');
                setIsCancelModalOpen(true);
              }}
              title="Cancel Return"
            >
              <XCircle size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="module-shell-page returns-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Sales Returns' },
        ]}
      />

      <PageHeader
        title="Sales Returns"
        subtitle="Manage customer returns, enforce historical rate protection, and restore eligible stock to inventory."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<History size={16} />}
              onClick={() => navigate('/sales-returns/history')}
            >
              Returns History
            </Button>
            {canCreateReturn && (
              <Button
                variant="primary"
                leftIcon={<PlusCircle size={16} />}
                onClick={handleOpenAddModal}
              >
                New Sales Return
              </Button>
            )}
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="returns-kpis">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper primary">
            <RotateCcw size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Today's Returns</span>
            <span className="kpi-value">{summary?.todayReturnCount ?? 0}</span>
            <span className="kpi-subtext">Completed returns today</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper error">
            <Coins size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Today's Refund</span>
            <span className="kpi-value">
              {summary ? formatCurrency(summary.todayReturnAmount) : '₹0.00'}
            </span>
            <span className="kpi-subtext">Total refunded today</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper success">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Completed Returns</span>
            <span className="kpi-value">{summary?.completedCount ?? 0}</span>
            <span className="kpi-subtext">Restocked in inventory</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper warning">
            <Clock size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Open Drafts</span>
            <span className="kpi-value">{summary?.draftCount ?? 0}</span>
            <span className="kpi-subtext">Pending finalization</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper neutral">
            <Ban size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Cancelled Returns</span>
            <span className="kpi-value">{summary?.cancelledCount ?? 0}</span>
            <span className="kpi-subtext">Reversed returns</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
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
              placeholder="Search by Return # (RET-...) or Bill # (INV-...)"
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
              setStatusFilter(e.target.value as ReturnStatus | '');
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
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            title="Start date"
          />

          <input
            type="date"
            className="filter-select"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            title="End date"
          />

          {(search || statusFilter || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Returns Ledger DataTable */}
      <Card>
        {isLoading ? (
          <LoadingState message="Loading sales returns records..." />
        ) : error ? (
          <ErrorState
            title="Error Loading Returns"
            message={error}
            onRetry={fetchReturns}
          />
        ) : returnsList.length === 0 ? (
          <EmptyState
            icon={<RotateCcw size={48} />}
            title="No Sales Returns Found"
            description={
              search || statusFilter || startDate || endDate
                ? 'No returns match the specified filters.'
                : 'No sales returns have been recorded yet. Click "New Sales Return" to begin.'
            }
            action={
              canCreateReturn
                ? {
                    label: 'Create First Return',
                    onClick: handleOpenAddModal,
                    variant: 'primary',
                  }
                : undefined
            }
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

      {/* MODAL: New Sales Return Wizard */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmittingReturn && setIsAddModalOpen(false)}
        title="Create Sales Return"
        size="lg"
      >
        <div className="production-form">
          {/* STEP 1: Search Existing Bill */}
          <div className="bill-lookup-section">
            <label className="form-label" htmlFor={searchBillInputId}>
              Search Original Sales Invoice <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div className="lookup-input-row">
              <input
                id={searchBillInputId}
                type="text"
                className="form-input"
                placeholder="Enter Bill # (e.g. INV-2026-0001) or sale UUID..."
                value={billSearchQuery}
                onChange={(e) => setBillSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookupBill(billSearchQuery);
                  }
                }}
                disabled={isLoadingPreview || isSubmittingReturn}
              />
              <Button
                variant="primary"
                type="button"
                onClick={() => handleLookupBill(billSearchQuery)}
                isLoading={isLoadingPreview}
                leftIcon={<Search size={15} />}
                disabled={!billSearchQuery.trim() || isSubmittingReturn}
              >
                Lookup Invoice
              </Button>
            </div>

            {/* Quick Select Chips for Recent Bills */}
            {recentBills.length > 0 && !preview && (
              <div>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Quick Select from Recent Bills:
                </span>
                <div className="recent-bills-chips">
                  {recentBills.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="recent-bill-chip"
                      onClick={() => handleLookupBill(b.billNumber)}
                      disabled={isLoadingPreview}
                    >
                      <Receipt size={12} />
                      <strong>#{b.billNumber}</strong> ({formatCurrency(b.finalTotalAmount)})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Return Preview & Item Selection */}
          {isLoadingPreview ? (
            <LoadingState message="Fetching invoice details and calculating returnable quantities..." />
          ) : preview ? (
            <>
              {/* Original Bill Specs */}
              <div className="bill-preview-header">
                <div className="preview-meta-item">
                  <span className="preview-meta-label">Original Invoice</span>
                  <span className="preview-meta-val">#{preview.billNumber}</span>
                </div>
                <div className="preview-meta-item">
                  <span className="preview-meta-label">Customer</span>
                  <span className="preview-meta-val">
                    {preview.customerName || 'Walk-in Customer'}
                  </span>
                </div>
                <div className="preview-meta-item">
                  <span className="preview-meta-label">Original Bill Total</span>
                  <span className="preview-meta-val">{formatCurrency(preview.totalBillAmount)}</span>
                </div>
                <div className="preview-meta-item">
                  <span className="preview-meta-label">Max Returnable Eligible</span>
                  <span className="preview-meta-val" style={{ color: 'var(--color-success)' }}>
                    {formatCurrency(preview.totalEligibleAmount)}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Select Products to Return:
                  </label>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {Object.keys(selectedItems).length} item(s) selected
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="return-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30px' }}>Select</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Sold</th>
                        <th style={{ textAlign: 'right' }}>Returned</th>
                        <th style={{ textAlign: 'right' }}>Returnable</th>
                        <th style={{ textAlign: 'right' }}>Historical Rate</th>
                        <th style={{ textAlign: 'center' }}>Return Qty</th>
                        <th>Restock?</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((item) => {
                        const isSelected = !!selectedItems[item.saleItemId];
                        const sel = selectedItems[item.saleItemId];

                        return (
                          <tr
                            key={item.saleItemId}
                            style={{
                              backgroundColor: isSelected
                                ? 'rgba(63, 67, 143, 0.04)'
                                : undefined,
                              opacity: item.isEligibleForReturn ? 1 : 0.6,
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!item.isEligibleForReturn || isSubmittingReturn}
                                onChange={() => handleToggleItem(item)}
                              />
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.productName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                {item.weightOrPack || item.productCode}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {item.soldQuantity} {item.unitSymbol}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {item.alreadyReturnedQuantity} {item.unitSymbol}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {item.isEligibleForReturn ? (
                                <span className="returnable-pill">
                                  {item.remainingReturnableQuantity} {item.unitSymbol}
                                </span>
                              ) : (
                                <span className="returnable-pill depleted">Depleted</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="rate-locked-badge">{formatCurrency(item.unitRate)}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isSelected ? (
                                <input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  max={item.remainingReturnableQuantity}
                                  className="return-qty-input"
                                  value={sel?.returnedQuantity ?? item.remainingReturnableQuantity}
                                  onChange={(e) =>
                                    handleQuantityChange(
                                      item.saleItemId,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  disabled={isSubmittingReturn}
                                />
                              ) : (
                                <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                              )}
                            </td>
                            <td>
                              {isSelected ? (
                                <select
                                  className="form-select"
                                  style={{ padding: '4px 6px', fontSize: '12px' }}
                                  value={sel?.restockCondition}
                                  onChange={(e) =>
                                    handleRestockConditionChange(
                                      item.saleItemId,
                                      e.target.value as RestockCondition
                                    )
                                  }
                                  disabled={isSubmittingReturn}
                                >
                                  <option value="RESTOCKABLE">Restock to Stock</option>
                                  <option value="DAMAGED_DISCARD">Damaged (No Restock)</option>
                                </select>
                              ) : (
                                <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {isSelected
                                ? formatCurrency(sel.returnedQuantity * sel.unitRate)
                                : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* STEP 3: Return Configuration & Refund Settings */}
              {Object.keys(selectedItems).length > 0 && (
                <div className="return-config-box">
                  <div className="return-total-summary-card">
                    <div>
                      <span className="summary-amount-title">Calculated Total Refund</span>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        Based exclusively on original locked invoice rates
                      </div>
                    </div>
                    <span className="summary-amount-val">
                      {formatCurrency(calculatedTotalRefund)}
                    </span>
                  </div>

                  {/* Refund Payment Mode Selector */}
                  <div className="form-group">
                    <label className="form-label">
                      Refund Mode <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <div className="refund-mode-selector">
                      <button
                        type="button"
                        className={`refund-mode-btn ${refundMode === 'CASH' ? 'active' : ''}`}
                        onClick={() => setRefundMode('CASH')}
                        disabled={isSubmittingReturn}
                      >
                        <Wallet size={16} /> Cash
                      </button>
                      <button
                        type="button"
                        className={`refund-mode-btn ${refundMode === 'UPI' ? 'active' : ''}`}
                        onClick={() => setRefundMode('UPI')}
                        disabled={isSubmittingReturn}
                      >
                        <Coins size={16} /> UPI / QR
                      </button>
                      <button
                        type="button"
                        className={`refund-mode-btn ${refundMode === 'STORE_CREDIT' ? 'active' : ''}`}
                        onClick={() => setRefundMode('STORE_CREDIT')}
                        disabled={isSubmittingReturn}
                      >
                        <CreditCard size={16} /> Store Credit
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor={returnReasonInputId}>
                      Return Reason <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <input
                      id={returnReasonInputId}
                      type="text"
                      className="form-input"
                      placeholder="e.g. Customer changed mind, pack damaged before open..."
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      disabled={isSubmittingReturn}
                    />
                  </div>

                  <div className="alert-box info">
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>
                      Completing this return will immediately increment warehouse stock for all items
                      marked <strong>Restock to Stock</strong> via <code>StockService</code>.
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : null}

          <div className="modal-action-footer">
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmittingReturn}
            >
              Cancel
            </Button>

            {preview && Object.keys(selectedItems).length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSubmitReturn('DRAFT')}
                  isLoading={isSubmittingReturn}
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSubmitReturn('COMPLETED')}
                  isLoading={isSubmittingReturn}
                  leftIcon={<CheckCircle2 size={16} />}
                >
                  Complete Return & Restock
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL: Edit Return Draft */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isUpdatingDraft && setIsEditModalOpen(false)}
        title={`Edit Draft — Return #${editingDraft?.returnNumber || ''}`}
        size="md"
      >
        <div className="production-form">
          <div className="alert-box info">
            <span>
              Modifying draft return for Bill #{editingDraft?.originalBillNumber}. Total return
              amount: <strong>{formatCurrency(editingDraft?.totalReturnAmount)}</strong>.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={editReasonInputId}>
              Return Reason <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id={editReasonInputId}
              type="text"
              className="form-input"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              disabled={isUpdatingDraft}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Refund Mode</label>
            <div className="refund-mode-selector">
              <button
                type="button"
                className={`refund-mode-btn ${editRefundMode === 'CASH' ? 'active' : ''}`}
                onClick={() => setEditRefundMode('CASH')}
                disabled={isUpdatingDraft}
              >
                Cash
              </button>
              <button
                type="button"
                className={`refund-mode-btn ${editRefundMode === 'UPI' ? 'active' : ''}`}
                onClick={() => setEditRefundMode('UPI')}
                disabled={isUpdatingDraft}
              >
                UPI
              </button>
              <button
                type="button"
                className={`refund-mode-btn ${editRefundMode === 'STORE_CREDIT' ? 'active' : ''}`}
                onClick={() => setEditRefundMode('STORE_CREDIT')}
                disabled={isUpdatingDraft}
              >
                Store Credit
              </button>
            </div>
          </div>

          <div className="modal-action-footer">
            <Button
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isUpdatingDraft}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEditDraft} isLoading={isUpdatingDraft}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* DIALOG: Complete Return Draft */}
      <ConfirmationDialog
        isOpen={isCompleteDialogOpen}
        onClose={() => !isCompleting && setIsCompleteDialogOpen(false)}
        onConfirm={handleConfirmComplete}
        title="Complete Sales Return"
        variant="primary"
        isLoading={isCompleting}
        confirmText="Confirm & Restore Stock"
        message={
          <div>
            <p>
              Are you sure you want to finalize sales return{' '}
              <strong>#{completingReturn?.returnNumber}</strong>?
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
              This will refund{' '}
              <strong>{formatCurrency(completingReturn?.totalReturnAmount)}</strong> to the customer
              and restore eligible goods into active inventory.
            </div>
          </div>
        }
      />

      {/* MODAL: Cancel Return */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => !isCancelling && setIsCancelModalOpen(false)}
        title={`Cancel Sales Return #${cancellingReturn?.returnNumber || ''}`}
        size="md"
      >
        <div className="production-form">
          {cancellingReturn?.status === 'COMPLETED' ? (
            <div className="alert-box danger">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Warning: Stock & Accounting Reversal</strong>
                <p style={{ marginTop: '2px' }}>
                  This return was previously completed. Cancelling it will immediately reverse{' '}
                  <strong>{formatCurrency(cancellingReturn.totalReturnAmount)}</strong> and
                  subtract previously restocked quantities from inventory!
                </p>
              </div>
            </div>
          ) : (
            <div className="alert-box warning">
              <p>Cancelling this draft will permanently mark it as CANCELLED.</p>
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
              placeholder="State the reason for cancelling this sales return..."
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
