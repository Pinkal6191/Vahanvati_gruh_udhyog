import React, { useEffect, useState } from 'react';
import {
  Package,
  TrendingUp,
  Boxes,
  ArrowUpDown,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { Badge } from '../../components/ui/Badge/Badge';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  ProductReportResponse,
  ReportDatePeriod,
  ProductSaleRecord,
} from './reports.api';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import './Reports.css';

export const ProductSalesReportPage: React.FC = () => {
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  const [sortBy, setSortBy] = useState<'amount' | 'quantity' | 'bills'>('amount');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  const [productData, setProductData] = useState<ProductReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getProductSalesReport({
        period,
        startDate,
        endDate,
        sortBy,
        order,
        page,
        limit,
      });
      setProductData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load product sales report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductReport();
  }, [period, startDate, endDate, sortBy, order, page]);

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
      key: 'productName',
      header: 'Product Details',
      cell: (row: ProductSaleRecord) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.productName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Code: {row.productCode}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category / Subcategory',
      cell: (row: ProductSaleRecord) => (
        <div>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{row.categoryName}</span>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
            {row.subcategoryName}
          </span>
        </div>
      ),
    },
    {
      key: 'quantitySold',
      header: 'Quantity Sold',
      align: 'right' as const,
      cell: (row: ProductSaleRecord) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {row.quantitySold}
        </span>
      ),
    },
    {
      key: 'weightSold',
      header: 'Weight Sold',
      align: 'right' as const,
      cell: (row: ProductSaleRecord) => (
        <span style={{ textAlign: 'right', display: 'block' }}>
          {formatWeight(row.weightSold)}
        </span>
      ),
    },
    {
      key: 'billsCount',
      header: 'Bills',
      align: 'right' as const,
      cell: (row: ProductSaleRecord) => (
        <span style={{ textAlign: 'right', display: 'block' }}>
          <Badge variant="neutral" size="sm">{row.billsCount}</Badge>
        </span>
      ),
    },
    {
      key: 'averageSellingRate',
      header: 'Avg Rate',
      align: 'right' as const,
      cell: (row: ProductSaleRecord) => (
        <span style={{ textAlign: 'right', display: 'block', color: 'var(--text-secondary)' }}>
          {formatCurrency(row.averageSellingRate)}
        </span>
      ),
    },
    {
      key: 'salesAmount',
      header: 'Total Revenue',
      align: 'right' as const,
      cell: (row: ProductSaleRecord) => (
        <span
          style={{
            textAlign: 'right',
            display: 'block',
            fontWeight: 700,
            color: 'var(--color-primary-600, #2563eb)',
          }}
        >
          {formatCurrency(row.salesAmount)}
        </span>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports', path: '/reports' },
          { label: 'Product Sales' },
        ]}
      />

      <PageHeader
        title="Product-Wise Sales & Ranking"
        subtitle="Catalog sales distribution, revenue contribution, weights sold, and transaction frequencies."
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
          title="Error Loading Product Report"
          message={error}
          onRetry={fetchProductReport}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Total Revenue"
              value={productData ? formatCurrency(productData.summary.totalRevenue) : '₹0.00'}
              subtitle={productData?.summary.period || 'Selected Period'}
              badge={{ text: 'Product Sales', variant: 'brand' }}
              icon={<TrendingUp size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Products Sold"
              value={productData ? productData.summary.totalProductsCount : 0}
              subtitle="Distinct items purchased"
              icon={<Boxes size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Total Units Sold"
              value={productData ? productData.summary.totalQuantitySold : 0}
              subtitle="Packs & individual pieces"
              icon={<Package size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Top Seller Share"
              value={
                productData && productData.data.length > 0 && productData.summary.totalRevenue > 0
                  ? `${(
                      (productData.data[0].salesAmount / productData.summary.totalRevenue) *
                      100
                    ).toFixed(1)}%`
                  : '0%'
              }
              subtitle={
                productData && productData.data.length > 0
                  ? productData.data[0].productName
                  : 'No records'
              }
              badge={{ text: '#1 Rank', variant: 'success' }}
              icon={<TrendingUp size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* Product Sales Table Card */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Product Sales Ledger</h4>
                <span className="report-section-desc">
                  Ranked product performance for {productData?.summary.period || 'the period'}
                </span>
              </div>

              <div className="report-table-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowUpDown size={14} color="#64748b" />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as any);
                      setPage(1);
                    }}
                    className="report-filter-select"
                  >
                    <option value="amount">Sales Revenue</option>
                    <option value="quantity">Units Sold</option>
                    <option value="bills">Bill Frequency</option>
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
              data={productData?.data || []}
              keyExtractor={(row) => row.productId}
              isLoading={isLoading}
              emptyMessage="No product sales recorded for this period."
              page={productData?.pagination.page}
              totalPages={productData?.pagination.totalPages}
              total={productData?.pagination.total}
              limit={productData?.pagination.limit}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </>
      )}
    </div>
  );
};
