import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Boxes,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { ReportNav } from './components/ReportNav';
import { ReportKpiCard } from './components/ReportKpiCard';
import { DataTable } from '../../components/tables/DataTable/DataTable';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import {
  reportsApi,
  StockReconciliationResponse,
  StockReconciliationRecord,
} from './reports.api';
import './Reports.css';

export const StockReconciliationReportPage: React.FC = () => {
  const [reconciliation, setReconciliation] = useState<StockReconciliationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      key: 'cachedBalance',
      header: 'Cached Balance',
      align: 'right' as const,
      cell: (row: StockReconciliationRecord) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {row.cachedBalance}
        </span>
      ),
    },
    {
      key: 'ledgerTotal',
      header: 'Ledger Total (Sum of Deltas)',
      align: 'right' as const,
      cell: (row: StockReconciliationRecord) => (
        <span style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {row.ledgerTotal}
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
            color: row.difference === 0 ? '#059669' : '#dc2626',
          }}
        >
          {row.difference === 0 ? '0' : row.difference}
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
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports', path: '/reports' },
          { label: 'Reconciliation' },
        ]}
      />

      <PageHeader
        title="Stock Parity & Reconciliation Audit"
        subtitle="Authoritative zero-drift mathematical verification: Cached balance vs. full movement ledger history."
        actions={
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={16} />}
            onClick={fetchReconciliation}
            isLoading={isLoading}
          >
            Re-Audit Ledgers
          </Button>
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
                <h4 className="report-section-title">Itemized Reconciliation Audit</h4>
                <span className="report-section-desc">
                  Compares current cached stock table against real-time SUM(quantityDelta)
                </span>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={reconciliation?.data || []}
              keyExtractor={(row) => row.productId}
              isLoading={isLoading}
              emptyMessage="No inventory products found to audit."
            />
          </div>
        </>
      )}
    </div>
  );
};
