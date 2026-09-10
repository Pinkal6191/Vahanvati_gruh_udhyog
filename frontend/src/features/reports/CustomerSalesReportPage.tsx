import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  ArrowUpDown,
  Eye,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  CustomerReportResponse,
  ReportDatePeriod,
  CustomerSaleRecord,
} from './reports.api';
import {
  formatCurrency,
  formatWeight,
  formatDate,
  formatIndianMobile,
} from '../../utils/formatters';
import './Reports.css';

export const CustomerSalesReportPage: React.FC = () => {
  const navigate = useNavigate();

  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  const [sortBy, setSortBy] = useState<'purchases' | 'bills' | 'lastPurchase'>('purchases');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [minBills, setMinBills] = useState<number | undefined>();
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  const [customerData, setCustomerData] = useState<CustomerReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getCustomerSalesReport({
        period,
        startDate,
        endDate,
        minBills,
        sortBy,
        order,
        page,
        limit,
      });
      setCustomerData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load customer sales report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerReport();
  }, [period, startDate, endDate, minBills, sortBy, order, page]);

  const handleFilterChange = (filters: {
    period?: ReportDatePeriod;
    startDate?: string;
    endDate?: string;
  }) => {
    if (filters.period) setPeriod(filters.period);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setPage(1);
  };

  const columns = [
    {
      key: 'customerName',
      header: 'Customer',
      cell: (row: CustomerSaleRecord) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.customerName}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <Badge
              variant={row.customerType === 'NRI' ? 'warning' : 'info'}
              size="sm"
            >
              {row.customerType}
            </Badge>
            {row.billsCount > 1 && (
              <Badge variant="success" size="sm">Repeat</Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      cell: (row: CustomerSaleRecord) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {formatIndianMobile(row.mobile)}
        </span>
      ),
    },
    {
      key: 'billsCount',
      header: 'Bills',
      align: 'right' as const,
      cell: (row: CustomerSaleRecord) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {row.billsCount}
        </span>
      ),
    },
    {
      key: 'totalWeight',
      header: 'Total Weight',
      align: 'right' as const,
      cell: (row: CustomerSaleRecord) => (
        <span style={{ textAlign: 'right', display: 'block' }}>
          {formatWeight(row.totalWeight)}
        </span>
      ),
    },
    {
      key: 'averageBillValue',
      header: 'Avg Bill',
      align: 'right' as const,
      cell: (row: CustomerSaleRecord) => (
        <span style={{ textAlign: 'right', display: 'block', color: 'var(--text-secondary)' }}>
          {formatCurrency(row.averageBillValue)}
        </span>
      ),
    },
    {
      key: 'totalPurchases',
      header: 'Total Purchases',
      align: 'right' as const,
      cell: (row: CustomerSaleRecord) => (
        <span
          style={{
            textAlign: 'right',
            display: 'block',
            fontWeight: 700,
            color: 'var(--color-primary-600, #2563eb)',
          }}
        >
          {formatCurrency(row.totalPurchases)}
        </span>
      ),
    },
    {
      key: 'lastPurchaseDate',
      header: 'Last Active',
      cell: (row: CustomerSaleRecord) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {formatDate(row.lastPurchaseDate)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'History',
      cell: (row: CustomerSaleRecord) => (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Eye size={14} />}
          onClick={() => navigate(`/reports/customers/${row.customerId}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports', path: '/reports' },
          { label: 'Customer Analytics' },
        ]}
      />

      <PageHeader
        title="Customer Sales & Loyalty Analytics"
        subtitle="Customer purchase values, frequency, repeat rates, and historical patronage."
        actions={
          <ReportDateFilter
            period={period}
            startDate={startDate}
            endDate={endDate}
            onFilterChange={handleFilterChange}
            isLoading={isLoading}
          />
        }
      />

      <ReportNav />

      {error ? (
        <ErrorState
          title="Error Loading Customer Report"
          message={error}
          onRetry={fetchCustomerReport}
        />
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Active Customers"
              value={customerData ? customerData.summary.totalUniqueCustomers : 0}
              subtitle={customerData?.summary.period || 'Selected Period'}
              icon={<Users size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Repeat Customers"
              value={customerData ? customerData.summary.repeatCustomerCount : 0}
              subtitle="2 or more visits in period"
              badge={{ text: 'Loyal', variant: 'success' }}
              icon={<UserCheck size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Single-Visit Customers"
              value={customerData ? customerData.summary.singlePurchaseCustomerCount : 0}
              subtitle="1 purchase in period"
              icon={<UserX size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Repeat Customer Rate"
              value={
                customerData
                  ? `${customerData.summary.repeatPercentage}%`
                  : '0%'
              }
              subtitle="Repeat / Total customers"
              badge={{ text: 'Retention', variant: 'brand' }}
              icon={<TrendingUp size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* Customer Table Card */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Customer Ledger</h4>
                <span className="report-section-desc">
                  Ranked by purchases and transaction frequency
                </span>
              </div>

              <div className="report-table-controls">
                {/* Repeat Filter Toggle */}
                <select
                  value={minBills || ''}
                  onChange={(e) => {
                    setMinBills(e.target.value ? Number(e.target.value) : undefined);
                    setPage(1);
                  }}
                  className="report-filter-select"
                >
                  <option value="">All Customers</option>
                  <option value="2">Repeat Only (2+ Bills)</option>
                  <option value="3">Frequent Only (3+ Bills)</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowUpDown size={14} color="#64748b" />
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as any);
                      setPage(1);
                    }}
                    className="report-filter-select"
                  >
                    <option value="purchases">Total Purchases</option>
                    <option value="bills">Bill Count</option>
                    <option value="lastPurchase">Recent Activity</option>
                  </select>
                </div>

                <select
                  value={order}
                  onChange={(e) => {
                    setOrder(e.target.value as any);
                    setPage(1);
                  }}
                  className="report-filter-select"
                >
                  <option value="desc">Highest First (Desc)</option>
                  <option value="asc">Lowest First (Asc)</option>
                </select>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={customerData?.data || []}
              keyExtractor={(row) => row.customerId}
              isLoading={isLoading}
              emptyMessage="No customer transactions found for this period."
              page={customerData?.pagination.page}
              totalPages={customerData?.pagination.totalPages}
              total={customerData?.pagination.total}
              limit={customerData?.pagination.limit}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </>
      )}
    </div>
  );
};
