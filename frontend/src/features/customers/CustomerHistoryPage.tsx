import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  FileText,
  Receipt,
  TrendingUp,
  Scale,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { formatCurrency, formatDateTime, formatGramsToKg, formatIndianMobile } from '../../utils/formatters';
import { CustomersApi, CustomerPurchaseHistoryData } from './customers.api';
import './CustomerHistoryPage.css';

export const CustomerHistoryPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const [historyData, setHistoryData] = useState<CustomerPurchaseHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  const loadHistory = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await CustomersApi.getPurchaseHistory(customerId, page, limit);
      setHistoryData(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load customer purchase history from local server.');
    } finally {
      setIsLoading(false);
    }
  }, [customerId, page, limit]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (isLoading) {
    return (
      <div className="customer-history-loading">
        <LoadingState message="Loading customer purchase history & invoices..." size="lg" />
      </div>
    );
  }

  if (error || !historyData) {
    return (
      <div className="customer-history-error">
        <ErrorState
          title="Could Not Load Customer History"
          message={error || 'Unable to retrieve records for this customer.'}
          onRetry={loadHistory}
        />
      </div>
    );
  }

  const { customer, summary, bills, pagination } = historyData;

  return (
    <div className="customer-history-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Customers', path: '/customers' },
          { label: customer?.name || 'Customer Profile' },
          { label: 'Purchase History' },
        ]}
      />

      <PageHeader
        title={customer?.name || 'Customer Purchase History'}
        subtitle={`Lifetime billing history, product purchase breakdown, and payment records.`}
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/customers')}
            >
              Back to Customers
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={loadHistory}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* CUSTOMER PROFILE CARD */}
      <Card className="customer-profile-card">
        <div className="profile-header-grid">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div className="profile-details">
            <div className="profile-name-row">
              <h2 className="profile-name">{customer.name}</h2>
              <Badge variant={customer.customerType === 'NRI' ? 'brand' : 'neutral'} size="md">
                {customer.customerType === 'NRI' ? 'NRI Export Account' : 'Indian Local Account'}
              </Badge>
              <Badge variant={customer.isActive ? 'success' : 'neutral'} size="sm">
                {customer.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="profile-meta-row">
              {customer.mobile && (
                <span className="profile-meta-item">
                  <Phone size={14} />
                  {formatIndianMobile(customer.mobile)}
                </span>
              )}
              {customer.city && (
                <span className="profile-meta-item">
                  <MapPin size={14} />
                  {customer.city}, {customer.country || 'India'}
                </span>
              )}
              {customer.gstin && (
                <span className="profile-meta-item">
                  <FileText size={14} />
                  GST: {customer.gstin}
                </span>
              )}
            </div>
            {customer.address && <p className="profile-address">{customer.address}</p>}
          </div>
        </div>
      </Card>

      {/* LIFETIME METRICS CARDS */}
      <div className="history-kpi-grid">
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper sales-bg">
            <TrendingUp size={22} className="sales-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Lifetime Purchases</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{formatCurrency(summary.totalPurchases)}</span>
            </div>
            <span className="kpi-subtext">Avg Bill: {formatCurrency(summary.averageBillValue)}</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-icon-wrapper invoices-bg">
            <Receipt size={22} className="invoices-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Completed Invoices</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{summary.billCount}</span>
              <Badge variant="success" size="sm">Bills</Badge>
            </div>
            <span className="kpi-subtext">Total visits / purchases</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-icon-wrapper prod-bg">
            <Scale size={22} className="prod-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Weight Bought</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{formatGramsToKg(summary.totalBaseWeightPurchased)}</span>
            </div>
            <span className="kpi-subtext">Cumulative merchandise weight</span>
          </div>
        </Card>
      </div>

      {/* INVOICES & BILL HISTORY */}
      <Card
        title="Invoices & Bills Record"
        subtitle={`Showing ${bills.length} invoices of ${pagination?.total || bills.length} total completed sales`}
      >
        {bills.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={48} />}
            title="No Invoices Found"
            description="This customer does not have any recorded sales yet. Once a bill is completed at POS, it will appear here."
          />
        ) : (
          <div className="history-bills-list">
            {bills.map((bill) => (
              <div key={bill.id} className="bill-history-item">
                <div className="bill-history-header">
                  <div className="bill-header-left">
                    <span className="bill-number-tag">{bill.billNumber}</span>
                    <span className="bill-date-tag">{formatDateTime(bill.createdAt)}</span>
                    <Badge variant={bill.saleStatus === 'COMPLETED' ? 'success' : 'neutral'} size="sm">
                      {bill.saleStatus}
                    </Badge>
                  </div>
                  <div className="bill-header-right">
                    <span className="bill-amount-label">Total Amount:</span>
                    <span className="bill-amount-value">{formatCurrency(bill.finalTotalAmount)}</span>
                  </div>
                </div>

                {/* Line Items Breakdown */}
                {bill.items && bill.items.length > 0 && (
                  <div className="bill-items-table-wrapper">
                    <table className="bill-items-mini-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.productNameSnapshot}</td>
                            <td>
                              {item.quantity} {item.unitSymbolSnapshot || ''}
                            </td>
                            <td>{formatCurrency(item.unitRate)}</td>
                            <td className="bill-item-subtotal">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Payment Breakdown Tags */}
                {bill.payments && bill.payments.length > 0 && (
                  <div className="bill-payments-footer">
                    <span className="payment-footer-label">Paid via:</span>
                    {bill.payments.map((p, pIdx) => (
                      <span key={pIdx} className="payment-footer-badge">
                        {p.paymentMode}: {formatCurrency(p.amount)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {pagination && pagination.totalPages > 1 && (
              <div style={{ marginTop: '16px' }}>
                <Pagination
                  page={page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  limit={limit}
                  onPageChange={(p) => setPage(p)}
                />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
