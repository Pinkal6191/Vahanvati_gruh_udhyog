import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Boxes,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { ReportHeader } from './components/ReportHeader';
import { ReportNav } from './components/ReportNav';
import { ReportKpiCard } from './components/ReportKpiCard';
import { ReportEmptyState } from './components/ReportEmptyState';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Badge } from '../../components/ui/Badge/Badge';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { ReportExportToolbar } from './components/ReportExportToolbar';
import {
  reportsApi,
  StockReconciliationResponse,
  StockReconciliationRecord,
} from './reports.api';
import { formatGramsToKg, formatDeltaWeight } from '../../utils/formatters';
import './Reports.css';

export const StockReconciliationReportPage: React.FC = () => {
  const [reconciliation, setReconciliation] = useState<StockReconciliationResponse | null>(null);
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
        '/reports/stock/reconciliation',
        {},
        format,
        `stock-reconciliation-${dateStr}.${format}`
      );
    } catch (err: any) {
      alert(err?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setIsExportingExcel(false);
      setIsExportingPdf(false);
    }
  };

  const fetchReconciliation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getStockReconciliationReport();
      setReconciliation(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to audit stock reconciliation parity.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliation();
  }, []);

  const columns = [
    {
      key: 'productName',
      header: 'Audited Product',
      cell: (row: StockReconciliationRecord) => (
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
      key: 'cachedBalance',
      header: 'Cached Balance',
      align: 'right' as const,
      cell: (row: StockReconciliationRecord) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {formatGramsToKg(row.cachedBalance)}
        </span>
      ),
    },
    {
      key: 'ledgerTotal',
      header: 'Ledger Total (Sum of Deltas)',
      align: 'right' as const,
      cell: (row: StockReconciliationRecord) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {formatGramsToKg(row.ledgerTotal)}
        </span>
      ),
    },
    {
      key: 'difference',
      header: 'Discrepancy Drift',
      align: 'right' as const,
      cell: (row: StockReconciliationRecord) => (
        <span
          style={{
            textAlign: 'right',
            display: 'block',
            fontWeight: 700,
            color: row.difference === 0 ? '#16803C' : '#C62828',
          }}
        >
          {row.difference === 0 ? '0 g' : formatDeltaWeight(row.difference)}
        </span>
      ),
    },
    {
      key: 'isConsistent',
      header: 'Parity Status',
      cell: (row: StockReconciliationRecord) =>
        row.isConsistent ? (
          <Badge variant="success">CONSISTENT</Badge>
        ) : (
          <Badge variant="danger">MISMATCH</Badge>
        ),
    },
  ];

  return (
    <div className="report-page-container">
      <ReportHeader
        breadcrumbs={[
          { label: 'Reports', path: '/reports' },
          { label: 'Reconciliation' },
        ]}
        title="Stock Parity & Reconciliation Audit"
        subtitle="Authoritative zero-drift mathematical verification: Cached balance vs. full movement ledger history."
        actions={
          <ReportExportToolbar
            onRefresh={fetchReconciliation}
            onExportExcel={() => handleExport('xlsx')}
            onExportPdf={() => handleExport('pdf')}
            isLoading={isLoading}
            isExportingExcel={isExportingExcel}
            isExportingPdf={isExportingPdf}
            disabled={isLoading || !reconciliation}
          />
        }
      />

      <ReportNav />

      {error ? (
        <ErrorState
          title="Error Auditing Ledgers"
          message={error}
          onRetry={fetchReconciliation}
        />
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="report-kpi-grid">
            <ReportKpiCard
              title="Products Audited"
              value={reconciliation ? reconciliation.summary.totalAudited : 0}
              subtitle="Active inventory items"
              icon={<Boxes size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="100% Consistent"
              value={reconciliation ? reconciliation.summary.consistentCount : 0}
              subtitle="Zero balance drift detected"
              badge={{ text: 'Verified', variant: 'success' }}
              icon={<CheckCircle2 size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Discrepancy Drift"
              value={reconciliation ? reconciliation.summary.driftCount : 0}
              subtitle="Mismatched balances"
              badge={
                reconciliation && reconciliation.summary.driftCount > 0
                  ? { text: 'Alert', variant: 'danger' }
                  : { text: 'Zero Drift', variant: 'neutral' }
              }
              icon={<AlertCircle size={18} />}
              isLoading={isLoading}
            />

            <ReportKpiCard
              title="Overall Audit Status"
              value={
                reconciliation
                  ? reconciliation.summary.allConsistent
                    ? '100% Consistent'
                    : 'Discrepancy Found'
                  : 'Auditing...'
              }
              subtitle="Mathematical parity check"
              badge={
                reconciliation?.summary.allConsistent
                  ? { text: 'Zero Drift', variant: 'success' }
                  : { text: 'Mismatch', variant: 'danger' }
              }
              icon={
                reconciliation?.summary.allConsistent ? (
                  <ShieldCheck size={18} />
                ) : (
                  <ShieldAlert size={18} />
                )
              }
              isLoading={isLoading}
            />
          </div>

          {/* Table Card */}
          <div className="report-table-card">
            <div className="report-table-toolbar">
              <div>
                <h4 className="report-section-title">Physical Parity Audit Table</h4>
                <span className="report-section-desc">
                  Verification of cached database balance against movement ledger sum
                </span>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={reconciliation?.data || []}
              keyExtractor={(row) => row.productId}
              isLoading={isLoading}
              emptyState={
                <ReportEmptyState
                  title="No items to reconcile"
                  description="Products with physical inventory will appear here for mathematical parity verification."
                  minHeight={180}
                />
              }
            />
          </div>
        </>
      )}
    </div>
  );
};
