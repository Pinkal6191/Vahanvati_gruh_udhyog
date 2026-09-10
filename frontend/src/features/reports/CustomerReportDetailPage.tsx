import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Receipt,
  Calendar,
  Wallet,
  ShoppingBag,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportKpiCard } from './components/ReportKpiCard';
import { Card } from '../../components/ui/Card/Card';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import {
  reportsApi,
  CustomerHistoryResponse,
} from './reports.api';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatIndianMobile,
} from '../../utils/formatters';
import './Reports.css';

export const CustomerReportDetailPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const [history, setHistory] = useState<CustomerHistoryResponse | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!customerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getCustomerPurchaseHistory(customerId, {
        page,
        limit,
      });
      setHistory(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load customer purchase audit.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [customerId, page]);

  if (isLoading && !history) {
    return <LoadingState message="Loading customer purchase dossier..." />;
  }

  if (error || !history) {
    return (
      <div className="report-page-container">
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Reports', path: '/reports' },
            { label: 'Customers', path: '/reports/customers' },
            { label: 'Customer Detail' },
          ]}
        />
        <ErrorState
          title="Customer Not Found"
          message={error || 'Customer record could not be retrieved.'}
          onRetry={fetchHistory}
        />
      </div>
    );
  }

  const { customer, summary, data: sales, pagination } = history;

  return (
    <div className="report-page-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports', path: '/reports' },
          { label: 'Customers', path: '/reports/customers' },
          { label: customer.name },
        ]}
      />

      <PageHeader
        title={`Customer Audit: ${customer.name}`}
        subtitle={`Lifetime purchase history and transaction records for ${customer.name}.`}
        actions={
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/reports/customers')}
          >
            Back to Customers
          </Button>
        }
      />

      <ReportNav />

      {/* Customer Profile & Purchase KPIs */}
      <div className="report-kpi-grid">
        <Card className="report-kpi-card">
          <div className="report-kpi-top">
            <span className="report-kpi-title">Profile</span>
            <User size={18} color="#2563eb" />
          </div>
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#0f172a' }}>
            {customer.name}
          </div>
          <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
            <Badge
              variant={customer.customerType === 'NRI' ? 'warning' : 'info'}
              size="sm"
            >
              {customer.customerType}
            </Badge>
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {formatIndianMobile(customer.mobile)}
          </span>
        </Card>

        <ReportKpiCard
          title="Lifetime Purchases"
          value={formatCurrency(summary.totalPurchases)}
          subtitle="Cumulative sales value"
          badge={{ text: 'Completed', variant: 'success' }}
          icon={<Wallet size={18} />}
        />

        <ReportKpiCard
          title="Total Bills"
          value={summary.totalBills}
          subtitle={`Avg Bill: ${formatCurrency(summary.averageBillValue)}`}
          icon={<Receipt size={18} />}
        />

        <ReportKpiCard
          title="Customer Timeline"
          value={summary.firstPurchaseDate ? formatDate(summary.firstPurchaseDate) : '-'}
          subtitle={`Last active: ${summary.lastPurchaseDate ? formatDate(summary.lastPurchaseDate) : '-'}`}
          badge={{ text: 'First Purchase', variant: 'neutral' }}
          icon={<Calendar size={18} />}
        />
      </div>

      {/* Itemized Purchase History */}
      <div className="report-table-card">
        <div className="report-table-toolbar">
          <div>
            <h4 className="report-section-title">Completed Bills Ledger</h4>
            <span className="report-section-desc">
              All transactions recorded for {customer.name}
            </span>
          </div>
        </div>

        {sales.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            No purchase transactions found for this customer.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px' }}>
            {sales.map((sale) => (
              <Card key={sale.id} style={{ padding: '16px', border: '1px solid #e2e8f0' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '10px',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Receipt size={16} color="#2563eb" />
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>
                      {sale.billNumber}
                    </span>
                    <Badge variant="success" size="sm">
                      {sale.saleStatus}
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {formatDateTime(sale.createdAt)}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '16px',
                        color: 'var(--color-primary-600, #2563eb)',
                      }}
                    >
                      {formatCurrency(sale.finalTotalAmount)}
                    </span>
                  </div>
                </div>

                {/* Items preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sale.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        color: '#334155',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShoppingBag size={12} color="#94a3b8" />
                        {item.productNameSnapshot} × {item.quantity}
                      </span>
                      <span>
                        @ {formatCurrency(item.unitRate)} ={' '}
                        <strong>{formatCurrency(item.total)}</strong>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Payment breakdown preview */}
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #e2e8f0',
                    fontSize: '12px',
                    color: '#64748b',
                  }}
                >
                  <span>Payments:</span>
                  {sale.payments.map((p) => (
                    <span key={p.id} style={{ fontWeight: 600, color: '#0f172a' }}>
                      {p.paymentMode}: {formatCurrency(p.amount)}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
