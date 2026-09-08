import React from 'react';
import { BarChart3, Download, Calendar } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const ReportsPage: React.FC = () => {
  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports & Analytics' },
        ]}
      />

      <PageHeader
        title="Reports & Business Analytics"
        subtitle="Authoritative analytics: Daily sales summaries, product-wise sales, production yields, return audits, and payment breakdowns."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<Calendar size={16} />}
              disabled
            >
              Date Filter
            </Button>
            <Button
              variant="primary"
              leftIcon={<Download size={16} />}
              disabled
              title="CSV / PDF export available in Reports step"
            >
              Export Report
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<BarChart3 size={48} />}
          title="Reporting & Analytics Engine (Step 9) Active"
          description="Read-only analytics layer built directly on authoritative sales, stock, and return ledgers. Supports real-time aggregations, Indian vs. NRI turnover breakdowns, and payment reconciliations."
        />
      </Card>
    </div>
  );
};
