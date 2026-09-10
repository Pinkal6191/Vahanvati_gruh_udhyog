import React, { useEffect, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Scale,
  Filter,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportKpiCard } from './components/ReportKpiCard';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Pagination } from '../../components/tables/Pagination/Pagination';
import { Badge } from '../../components/ui/Badge/Badge';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  StockReportResponse,
  StockReportRecord,
} from './reports.api';
import { formatWeight, formatDate } from '../../utils/formatters';
import './Reports.css';

export const StockReportPage: React.FC = () => {
  const [status, setStatus] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  const [stockData, setStockData] = useState<StockReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStockReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getStockReport({
        status,
        page,
        limit,
      });
      setStockData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load stock inventory report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockReport();
  }, [status, page]);

  const columns = [
    {
      key: 'productName',
      header: 'Product Details',
      cell: (row: StockReportRecord) => (
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
      cell: (row: StockReportRecord) => (
        <div>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{row.categoryName}</span>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
            {row.subcategoryName}
          </span>
        </div>
      ),
    },
    {
      key: 'currentBalance',
      header: 'Current Balance',
      align: 'right' as const,
      cell: (row: StockReportRecord) => (
        <span
          style={{
            textAlign: 'right',
            display: 'block',
            fontWeight: 700,
            fontSize: '14px',
            color:
              row.stockStatus === 'OUT_OF_STOCK'
                ? '#dc2626'
                : row.stockStatus === 'LOW_STOCK'
                ? '#d97706'
                : '#059669',
          }}
        >
          {row.currentBalance} {row.unitSymbol}
        </span>
      ),
    },
    {
      key: 'minimumThreshold',
      header: 'Min Threshold',
      align: 'right' as const,
      cell: (row: StockReportRecord) => (
        <span style={{ textAlign: 'right', display: 'block', color: '#64748b' }}>
          {row.minimumThreshold} {row.unitSymbol}
        </span>
      ),
    },
    {
      key: 'stockStatus',
      header: 'Stock Status',
      cell: (row: StockReportRecord) => {
        if (row.stockStatus === 'OUT_OF_STOCK') {
          return <Badge variant="danger">Out of Stock</Badge>;
        }
        if (row.stockStatus === 'LOW_STOCK') {
          return <Badge variant="warning">Low Stock</Badge>;
        }
        return <Badge variant="success">In Stock</Badge>;
      },
    },
    {
      key: 'lastUpdatedAt',
      header: 'Last Balance Update',
      cell: (row: StockReportRecord) => (
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          {formatDate(row.lastUpdatedAt)}
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
          { label: 'Stock Report' },
        ]}
      />

      <PageHeader
        title="Stock & Inventory Balance Report"
        subtitle="Current physical balances, reorder threshold health, and category-level stock distribution."
      />

      <ReportNav />

      {error ? (
        <ErrorState
          title="Error Loading Stock Report"
          message={error}
          onRetry={fetchStockReport}
        />
      ) : (
        <>
          {/* Stock KPIs */}
          <div className="report-kpi-grid-5">
            <ReportKpiCard
              title="Total Products"
              value={stockData ? stockData.summary.totalProductsCount : 0}
              subtitle="Active catalog items"
              icon={<Boxes size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="In-Stock Healthy"
              value={stockData ? stockData.summary.inStockCount : 0}
              subtitle="Above threshold"
              badge={{ text: 'Healthy', variant: 'success' }}
              icon={<CheckCircle2 size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Low Stock Alert"
              value={stockData ? stockData.summary.lowStockCount : 0}
              subtitle="At or below threshold"
              badge={{ text: 'Reorder', variant: 'warning' }}
              icon={<AlertTriangle size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Stockout Depleted"
              value={stockData ? stockData.summary.outOfStockCount : 0}
              subtitle="Zero balance"
              badge={{ text: 'Critical', variant: 'danger' }}
              icon={<XCircle size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Aggregate Weight"
              value={stockData ? formatWeight(stockData.summary.totalStockWeight) : '0 GM'}
              subtitle="Total physical mass"
              icon={<Scale size={18} />}
              isLoading={isLoading}
            />
          </div>

          {/* Stock Table Card */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Physical Stock Inventory</h4>
                <span className="report-section-desc">
                  Real-time balances tracked in backend StockService
                </span>
              </div>

              <div className="report-table-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={14} color="#64748b" />
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as any);
                      setPage(1);
                    }}
                    className="report-filter-select"
                  >
                    <option value="ALL">All Stock Statuses</option>
                    <option value="IN_STOCK">In-Stock Only</option>
                    <option value="LOW_STOCK">Low Stock Only</option>
                    <option value="OUT_OF_STOCK">Out of Stock Only</option>
                  </select>
                </div>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={stockData?.data || []}
              keyExtractor={(row) => row.productId}
              isLoading={isLoading}
              emptyMessage="No inventory items found matching this filter."
              page={stockData?.pagination.page}
              totalPages={stockData?.pagination.totalPages}
              total={stockData?.pagination.total}
              limit={stockData?.pagination.limit}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </>
      )}
    </div>
  );
};
