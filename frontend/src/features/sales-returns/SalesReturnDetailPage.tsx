import React, { useState, useEffect, useCallback, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Receipt,
  Wallet,
  Coins,
  CreditCard,
  Package,
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
import {
  salesReturnsApi,
  SalesReturn,
  ReturnStatus,
  RefundPaymentMode,
} from './sales-returns.api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import './SalesReturnsPage.css';

export const SalesReturnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();

  const [returnDoc, setReturnDoc] = useState<SalesReturn | null>(null);
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

  const fetchReturn = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await salesReturnsApi.getById(id);
      setReturnDoc(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sales return details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReturn();
  }, [fetchReturn]);

  // Complete Draft
  const handleConfirmComplete = async () => {
    if (!returnDoc) return;
    setIsCompleting(true);
    try {
      await salesReturnsApi.complete(returnDoc.id);
      showSuccess(`Return #${returnDoc.returnNumber} completed! Stock restored to inventory.`);
      setIsCompleteDialogOpen(false);
      fetchReturn();
    } catch (err: any) {
      showError(err.message || 'Failed to finalize return');
    } finally {
      setIsCompleting(false);
    }
  };

  // Cancel Return
  const handleConfirmCancel = async () => {
    if (!returnDoc) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      showError('Please provide a cancellation reason (minimum 3 characters)');
      return;
    }

    setIsCancelling(true);
    try {
      await salesReturnsApi.cancel(returnDoc.id, cancelReason.trim());
      showSuccess(
        returnDoc.status === 'COMPLETED'
          ? `Return #${returnDoc.returnNumber} cancelled. Restocked inventory reversed!`
          : `Return draft #${returnDoc.returnNumber} cancelled.`
      );
      setIsCancelModalOpen(false);
      setCancelReason('');
      fetchReturn();
    } catch (err: any) {
      showError(err.message || 'Failed to cancel return');
    } finally {
      setIsCancelling(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="module-shell-page">
        <LoadingState message="Loading sales return record..." />
      </div>
    );
  }

  if (error || !returnDoc) {
    return (
      <div className="module-shell-page">
        <ErrorState
          title="Sales Return Not Found"
          message={error || 'The requested return record could not be loaded.'}
          onRetry={fetchReturn}
        />
      </div>
    );
  }

  return (
    <div className="module-shell-page returns-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Sales Returns', path: '/sales-returns' },
          { label: returnDoc.returnNumber },
        ]}
      />

      <PageHeader
        title={`Return #${returnDoc.returnNumber}`}
        subtitle={`Recorded on ${formatDateTime(returnDoc.createdAt)} for Original Sale #${returnDoc.originalBillNumber}`}
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/sales-returns')}
            >
              Back to List
            </Button>

            {returnDoc.status === 'DRAFT' && (
              <Button
                variant="primary"
                leftIcon={<CheckCircle2 size={16} />}
                onClick={() => setIsCompleteDialogOpen(true)}
              >
                Complete & Restore Stock
              </Button>
            )}

            {returnDoc.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                leftIcon={<XCircle size={16} />}
                style={{ color: 'var(--color-error)' }}
                onClick={() => {
                  setCancelReason('');
                  setIsCancelModalOpen(true);
                }}
              >
                Cancel Return
              </Button>
            )}
          </div>
        }
      />

      {/* Lifecycle Status Notice Banner */}
      {returnDoc.status === 'DRAFT' && (
        <div className="alert-box warning">
          <Clock size={20} />
          <div>
            <strong>Status: Draft Return</strong>
            <p style={{ marginTop: '2px' }}>
              This return is currently in DRAFT. Stock has NOT yet been added back to inventory.
              Click "Complete & Restore Stock" to finalize the refund and restock goods.
            </p>
          </div>
        </div>
      )}

      {returnDoc.status === 'COMPLETED' && (
        <div className="alert-box info">
          <CheckCircle2 size={20} />
          <div>
            <strong>Status: Completed & Restocked</strong>
            <p style={{ marginTop: '2px' }}>
              Finalized on {formatDateTime(returnDoc.completedAt || returnDoc.updatedAt)}. Refund of{' '}
              <strong>{formatCurrency(returnDoc.totalReturnAmount)}</strong> via{' '}
              {returnDoc.refundPaymentMode} has been processed and eligible items were restored to
              warehouse stock via <code>StockService</code>.
            </p>
          </div>
        </div>
      )}

      {returnDoc.status === 'CANCELLED' && (
        <div className="alert-box danger">
          <AlertTriangle size={20} />
          <div>
            <strong>Status: Return Cancelled</strong>
            <p style={{ marginTop: '2px' }}>
              This return was cancelled. Reason: "{returnDoc.cancellationReason || 'No reason specified'}".
              Any restocked inventory was reversed.
            </p>
          </div>
        </div>
      )}

      {/* Detail Metadata Grid */}
      <div className="return-detail-grid">
        {/* Card 1: Return Information */}
        <Card title="Return Information">
          <div className="detail-card-section">
            <div className="detail-row">
              <span className="detail-label">Return Number</span>
              <span className="detail-value return-number-badge">{returnDoc.returnNumber}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className="detail-value">{renderStatusBadge(returnDoc.status)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Refund Mode</span>
              <span className="detail-value">{renderRefundMode(returnDoc.refundPaymentMode)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Total Refund Amount</span>
              <span className="detail-value" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-lg)' }}>
                {formatCurrency(returnDoc.totalReturnAmount)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Reason</span>
              <span className="detail-value">{returnDoc.reason}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Logged By</span>
              <span className="detail-value">
                {returnDoc.createdBy?.fullName || returnDoc.createdBy?.username || 'Staff'}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Original Sale Reference */}
        <Card title="Original Invoice Details">
          <div className="detail-card-section">
            <div className="detail-row">
              <span className="detail-label">Original Bill Number</span>
              <span className="detail-value original-bill-badge">#{returnDoc.originalBillNumber}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Customer Name</span>
              <span className="detail-value">{returnDoc.customerName || 'Walk-in Customer'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Customer Mobile</span>
              <span className="detail-value">{returnDoc.customerMobile || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Customer Type</span>
              <span className="detail-value">{returnDoc.customerType || 'INDIAN'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Sale Date</span>
              <span className="detail-value">
                {returnDoc.saleDate ? formatDate(returnDoc.saleDate) : '-'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Returned Line Items Table */}
      <Card title="Returned Items Breakdown">
        <div style={{ overflowX: 'auto' }}>
          <table className="return-items-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Code</th>
                <th style={{ textAlign: 'right' }}>Original Sold</th>
                <th style={{ textAlign: 'right' }}>Returned Qty</th>
                <th style={{ textAlign: 'right' }}>Historical Rate</th>
                <th>Restock Condition</th>
                <th style={{ textAlign: 'right' }}>Refund Amount</th>
              </tr>
            </thead>
            <tbody>
              {returnDoc.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.productName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {item.weightOrPack || item.unitSymbol}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {item.productCode}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {item.originalSoldQuantity} {item.unitSymbol}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {item.returnedQuantity} {item.unitSymbol}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="rate-locked-badge">{formatCurrency(item.unitRateSnapshot)}</span>
                  </td>
                  <td>
                    {item.restockCondition === 'RESTOCKABLE' ? (
                      <Badge variant="success">Restocked</Badge>
                    ) : (
                      <Badge variant="neutral">Damaged / Discarded</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-error)' }}>
                    {formatCurrency(item.refundAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, paddingTop: '14px' }}>
                  Total Refund Processed:
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: 'var(--font-size-lg)',
                    color: 'var(--color-error)',
                    paddingTop: '14px',
                  }}
                >
                  {formatCurrency(returnDoc.totalReturnAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Confirmation Dialog: Complete Return */}
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
              Are you sure you want to complete Return{' '}
              <strong>#{returnDoc.returnNumber}</strong>?
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
              This will finalize the refund of{' '}
              <strong>{formatCurrency(returnDoc.totalReturnAmount)}</strong> and restore inventory
              for all eligible items.
            </div>
          </div>
        }
      />

      {/* Modal: Cancel Return */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => !isCancelling && setIsCancelModalOpen(false)}
        title={`Cancel Return #${returnDoc.returnNumber}`}
        size="md"
      >
        <div className="production-form">
          {returnDoc.status === 'COMPLETED' ? (
            <div className="alert-box danger">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Warning: Stock & Financial Reversal</strong>
                <p style={{ marginTop: '2px' }}>
                  This return was previously completed. Cancelling it will immediately reverse{' '}
                  <strong>{formatCurrency(returnDoc.totalReturnAmount)}</strong> and subtract
                  restocked goods from inventory!
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
              placeholder="State the reason for cancelling this return..."
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
