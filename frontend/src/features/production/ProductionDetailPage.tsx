import React, { useState, useEffect, useCallback, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChefHat,
  Calendar,
  Clock,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Modal } from '../../components/ui/Modal/Modal';
import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog/ConfirmationDialog';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { useToast } from '../../hooks/useToast';
import { productionApi, ProductionEntry, ProductionStatus } from './production.api';
import { formatDate, formatDateTime } from '../../utils/formatters';
import './ProductionPage.css';

export const ProductionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();

  const [entry, setEntry] = useState<ProductionEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Complete Dialog
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Cancel Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const detailCancelReasonId = useId();

  const fetchEntry = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await productionApi.getById(id);
      setEntry(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load production entry');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  // Complete Draft
  const handleConfirmComplete = async () => {
    if (!entry) return;
    setIsCompleting(true);
    try {
      await productionApi.completeDraft(entry.id);
      showSuccess(`Batch ${entry.batchNumber} marked COMPLETED. Stock added to inventory!`);
      setIsCompleteDialogOpen(false);
      fetchEntry();
    } catch (err: any) {
      showError(err.message || 'Failed to complete production run');
    } finally {
      setIsCompleting(false);
    }
  };

  // Cancel Entry
  const handleConfirmCancel = async () => {
    if (!entry) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      showError('Please enter a valid cancellation reason (min 3 characters)');
      return;
    }

    setIsCancelling(true);
    try {
      await productionApi.cancel(entry.id, cancelReason.trim());
      showSuccess(
        entry.status === 'COMPLETED'
          ? `Batch ${entry.batchNumber} cancelled. Finished goods stock reversed!`
          : `Batch ${entry.batchNumber} draft cancelled.`
      );
      setIsCancelModalOpen(false);
      setCancelReason('');
      fetchEntry();
    } catch (err: any) {
      showError(err.message || 'Failed to cancel production entry');
    } finally {
      setIsCancelling(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="module-shell-page">
        <LoadingState message="Loading production batch details..." />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="module-shell-page">
        <ErrorState
          title="Production Batch Not Found"
          message={error || 'The requested batch does not exist.'}
          onRetry={fetchEntry}
        />
      </div>
    );
  }

  return (
    <div className="module-shell-page production-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Production', path: '/production' },
          { label: entry.batchNumber },
        ]}
      />

      <PageHeader
        title={`Batch: ${entry.batchNumber}`}
        subtitle={`Recorded on ${formatDate(entry.productionDate)} by ${
          entry.user?.fullName || entry.user?.username || 'Operator'
        }`}
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/production')}
            >
              Back to List
            </Button>

            {entry.status === 'DRAFT' && (
              <Button
                variant="primary"
                leftIcon={<CheckCircle2 size={16} />}
                onClick={() => setIsCompleteDialogOpen(true)}
              >
                Complete & Add Stock
              </Button>
            )}

            {entry.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                leftIcon={<XCircle size={16} />}
                style={{ color: 'var(--color-error)' }}
                onClick={() => {
                  setCancelReason('');
                  setIsCancelModalOpen(true);
                }}
              >
                Cancel Entry
              </Button>
            )}
          </div>
        }
      />

      {/* Status Notice Banner */}
      {entry.status === 'DRAFT' && (
        <div className="alert-box warning">
          <Clock size={20} />
          <div>
            <strong>Status: Draft Entry</strong>
            <p style={{ marginTop: '2px' }}>
              This batch is currently in DRAFT status. Inventory stock has NOT been increased yet.
              Click "Complete & Add Stock" when manufacturing packaging is finalized.
            </p>
          </div>
        </div>
      )}

      {entry.status === 'COMPLETED' && (
        <div className="alert-box info">
          <CheckCircle2 size={20} />
          <div>
            <strong>Status: Completed & Stock Credited</strong>
            <p style={{ marginTop: '2px' }}>
              This batch completed on {formatDateTime(entry.completedAt || entry.updatedAt)}. An
              authoritative stock increment of {entry.quantityProduced} {entry.unit?.symbol} was
              credited to finished goods inventory.
            </p>
          </div>
        </div>
      )}

      {entry.status === 'CANCELLED' && (
        <div className="alert-box danger">
          <AlertTriangle size={20} />
          <div>
            <strong>Status: Batch Cancelled</strong>
            <p style={{ marginTop: '2px' }}>
              Cancelled on {formatDateTime(entry.cancelledAt || entry.updatedAt)} by{' '}
              {entry.cancelledByUser?.fullName || 'Administrator'}. Reason: "
              {entry.cancellationReason || 'No reason specified'}".
            </p>
          </div>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="detail-meta-grid">
        {/* Product Information Card */}
        <Card title="Manufactured Product">
          <div className="detail-card-section">
            <div className="detail-row">
              <span className="detail-label">Product Name</span>
              <span className="detail-value">{entry.product?.name}</span>
            </div>
            {entry.product?.gujaratiName && (
              <div className="detail-row">
                <span className="detail-label">Gujarati Name</span>
                <span className="detail-value product-name-gu">{entry.product.gujaratiName}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Product Code</span>
              <span className="detail-value">{entry.product?.code}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Quantity Produced</span>
              <span className="detail-value" style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)' }}>
                {entry.quantityProduced} {entry.unit?.symbol}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Unit Type</span>
              <span className="detail-value">
                {entry.unit?.name} ({entry.unit?.symbol})
              </span>
            </div>
          </div>
        </Card>

        {/* Batch Lifecycle & Dates */}
        <Card title="Batch Execution & Lifecycle">
          <div className="detail-card-section">
            <div className="detail-row">
              <span className="detail-label">Batch Code</span>
              <span className="detail-value batch-number-badge">{entry.batchNumber}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Current Status</span>
              <span className="detail-value">{renderStatusBadge(entry.status)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Production Date</span>
              <span className="detail-value">{formatDate(entry.productionDate)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Expiry Date</span>
              <span className="detail-value">
                {entry.expiryDate ? formatDate(entry.expiryDate) : 'Not specified'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created At</span>
              <span className="detail-value">{formatDateTime(entry.createdAt)}</span>
            </div>
            {entry.completedAt && (
              <div className="detail-row">
                <span className="detail-label">Completed At</span>
                <span className="detail-value">{formatDateTime(entry.completedAt)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Audit & Staff Card */}
        <Card title="Audit & Remarks">
          <div className="detail-card-section">
            <div className="detail-row">
              <span className="detail-label">Logged By</span>
              <span className="detail-value">
                {entry.user?.fullName || entry.user?.username || 'System'}
              </span>
            </div>
            {entry.cancelledByUser && (
              <div className="detail-row">
                <span className="detail-label">Cancelled By</span>
                <span className="detail-value">{entry.cancelledByUser.fullName}</span>
              </div>
            )}
            <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span className="detail-label">Notes & Remarks</span>
              <p
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  marginTop: '4px',
                  fontStyle: entry.notes ? 'normal' : 'italic',
                }}
              >
                {entry.notes || 'No notes provided for this batch.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Complete Confirmation Dialog */}
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
              Are you sure you want to finalize batch <strong>{entry.batchNumber}</strong>?
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
                {entry.quantityProduced} {entry.unit?.symbol}
              </strong>{' '}
              into inventory for product <strong>{entry.product?.name}</strong>.
            </div>
          </div>
        }
      />

      {/* Cancel Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => !isCancelling && setIsCancelModalOpen(false)}
        title={`Cancel Batch ${entry.batchNumber}`}
        size="md"
      >
        <div className="production-form">
          {entry.status === 'COMPLETED' ? (
            <div className="alert-box danger">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Warning: Stock Reversal</strong>
                <p style={{ marginTop: '2px' }}>
                  Cancelling this completed batch will automatically reverse{' '}
                  <strong>
                    {entry.quantityProduced} {entry.unit?.symbol}
                  </strong>{' '}
                  from inventory!
                </p>
              </div>
            </div>
          ) : (
            <div className="alert-box warning">
              <p>Cancelling this draft will permanently mark it as CANCELLED.</p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor={detailCancelReasonId}>
              Cancellation Reason (Mandatory){' '}
              <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <textarea
              id={detailCancelReasonId}
              rows={3}
              className="form-textarea"
              placeholder="State the reason for cancelling this batch..."
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
