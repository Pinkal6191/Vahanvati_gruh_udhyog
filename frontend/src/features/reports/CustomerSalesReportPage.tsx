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
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { ReportExportToolbar } from './components/ReportExportToolbar';
import {
  reportsApi,
  CustomerReportResponse,
  ReportDatePeriod,
  CustomerSaleRecord,
  SaleType,
  CustomerType,
} from './reports.api';
import { useAuth } from '../../hooks/useAuth';
import {
  formatCurrency,
  formatWeight,
  formatDate,
  formatIndianMobile,
} from '../../utils/formatters';
import './Reports.css';

export const CustomerSalesReportPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  const [customerType, setCustomerType] = useState<CustomerType | undefined>();
  const [saleType, setSaleType] = useState<SaleType | undefined>();

  const permittedSaleTypes: SaleType[] = user?.isMasterAdmin
    ? ['RETAIL', 'NRI', 'WHOLESALE']
    : (user?.allowedReportSaleTypes && user.allowedReportSaleTypes.length > 0
        ? user.allowedReportSaleTypes
        : ['RETAIL']);

  const [sortBy, setSortBy] = useState<'purchases' | 'bills' | 'lastPurchase'>('purchases');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [minBills, setMinBills] = useState<number | undefined>();
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  const [customerData, setCustomerData] = useState<CustomerReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (format === 'xlsx') setIsExportingExcel(true);
    if (format === 'pdf') setIsExportingPdf(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await reportsApi.downloadReportFile(
        '/reports/sales/customers',
        { period, startDate, endDate, customerType, saleType, minBills, sortBy, order },
        format,
        `customer-sales-report-${dateStr}.${format}`
      );
    } catch (err: any) {
      alert(err?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setIsExportingExcel(false);
      setIsExportingPdf(false);
    }
  };

  const fetchCustomerReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getCustomerSalesReport({
        period,
        startDate,
        endDate,
        customerType,
        saleType,
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
  }, [period, startDate, endDate, customerType, saleType, minBills, sortBy, order, page]);

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
          <div style={{ fontWeight: 600, color: '#202124' }}>
            {row.customerName}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
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
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
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
        <span style={{ textAlign: 'right', display: 'block', color: '#6b7280' }}>
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
            color: '#3F438F',
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
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {formatDate(row.lastPurchaseDate)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'History',
      align: 'center' as const,
      cell: (row: CustomerSaleRecord) => (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Eye size={13} />}
          onClick={() => navigate(`/reports/customers/${row.customerId}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Customers' },
        ]}
        title="Customer Sales & Loyalty Analytics"
        subtitle="Customer purchase values, frequency, repeat rates, and historical patronage."
        actions={
          <div className="report-header-actions">
            <select
              aria-label="Filter by customer demographic"
              className="report-filter-select"
              value={customerType || ''}
              onChange={(e) => {
                setCustomerType((e.target.value as CustomerType) || undefined);
                setPage(1);
              }}
            >
              <option value="">All Customer Demographics</option>
              <option value="INDIAN">Indian Demographic</option>
              <option value="NRI">NRI Demographic</option>
            </select>

            {permittedSaleTypes.length > 1 && (
              <select
                aria-label="Filter by sale type tier"
                className="report-filter-select"
                value={saleType || ''}
                onChange={(e) => {
                  setSaleType((e.target.value as SaleType) || undefined);
                  setPage(1);
                }}
              >
                <option value="">All Permitted Tiers</option>
                {permittedSaleTypes.includes('RETAIL') && <option value="RETAIL">Retail Only</option>}
                {permittedSaleTypes.includes('NRI') && <option value="NRI">NRI Only</option>}
                {permittedSaleTypes.includes('WHOLESALE') && <option value="WHOLESALE">Wholesale Only</option>}
              </select>
            )}

            <ReportDateFilter
              period={period}
              startDate={startDate}
              endDate={endDate}
              onFilterChange={handleFilterChange}
              isLoading={isLoading}
            />
            <ReportExportToolbar
              onRefresh={fetchCustomerReport}
              onExportExcel={() => handleExport('xlsx')}
              onExportPdf={() => handleExport('pdf')}
              isLoading={isLoading}
              isExportingExcel={isExportingExcel}
              isExportingPdf={isExportingPdf}
              disabled={isLoading || !customerData}
            />
          </div>
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
                  aria-label="Filter customer visit frequency"
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
                    aria-label="Sort customer ledger"
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
                  aria-label="Sort direction order"
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
              emptyState={
                <ReportEmptyState
                  title="No customer activity yet"
                  description="Customer purchase history will appear here once sales are recorded."
                  minHeight={200}
                />
              }
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
