import React, { useEffect, useState } from 'react';
import {
  Package,
  TrendingUp,
  Boxes,
  ArrowUpDown,
} from 'lucide-react';
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportDateFilter } from './components/ReportDateFilter';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Badge } from '../../components/ui/Badge/Badge';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { ReportExportToolbar } from './components/ReportExportToolbar';
import {
  reportsApi,
  ProductReportResponse,
  ReportDatePeriod,
  ProductSaleRecord,
  SaleType,
} from './reports.api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import './Reports.css';

export const ProductSalesReportPage: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportDatePeriod>('this_month');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [saleType, setSaleType] = useState<SaleType | undefined>();

  const permittedSaleTypes: SaleType[] = user?.isMasterAdmin
    ? ['RETAIL', 'NRI', 'WHOLESALE']
    : (user?.allowedReportSaleTypes && user.allowedReportSaleTypes.length > 0
        ? user.allowedReportSaleTypes
        : ['RETAIL']);

  const [sortBy, setSortBy] = useState<'amount' | 'quantity' | 'bills'>('amount');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  const [productData, setProductData] = useState<ProductReportResponse | null>(null);
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
        '/reports/sales/products',
        { period, startDate, endDate, saleType, sortBy, order },
        format,
        `product-sales-report-${dateStr}.${format}`
      );
    } catch (err: any) {
      alert(err?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setIsExportingExcel(false);
      setIsExportingPdf(false);
    }
  };

  const fetchProductReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getProductSalesReport({
        period,
        startDate,
        endDate,
        saleType,
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
  }, [period, startDate, endDate, sortBy, order, page, saleType]);

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
          <div style={{ fontWeight: 600, color: '#202124' }}>
            {row.productName}
          </div>
          <div style={{ fontSize: '11.5px', color: '#6b7280' }}>
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
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#202124' }}>{row.categoryName}</span>
          <span style={{ fontSize: '11.5px', color: '#6b7280', display: 'block' }}>
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
        <span style={{ textAlign: 'right', display: 'block', color: '#6b7280' }}>
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
            color: '#3F438F',
          }}
        >
          {formatCurrency(row.salesAmount)}
        </span>
      ),
    },
  ];

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Products' },
        ]}
        title="Product-Wise Sales & Ranking"
        subtitle="Catalog sales distribution, revenue contribution, weights sold, and transaction frequencies."
        actions={
          <div className="report-header-actions">
            {permittedSaleTypes.length > 1 && (
              <select
                aria-label="Filter products by sale type tier"
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
              onRefresh={fetchProductReport}
              onExportExcel={() => handleExport('xlsx')}
              onExportPdf={() => handleExport('pdf')}
              isLoading={isLoading}
              isExportingExcel={isExportingExcel}
              isExportingPdf={isExportingPdf}
              disabled={isLoading || !productData}
            />
          </div>
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
          {/* Summary KPIs */}
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
                  : 'No sales recorded yet'
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
                    aria-label="Sort products by metric"
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
              data={productData?.data || []}
              keyExtractor={(row) => row.productId}
              isLoading={isLoading}
              emptyState={
                <ReportEmptyState
                  title="No product sales yet"
                  description="Product performance will appear after completed bills are recorded."
                  minHeight={200}
                />
              }
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
