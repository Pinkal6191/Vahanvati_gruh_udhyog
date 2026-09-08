import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, ShoppingCart, Filter } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const BillHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Billing', path: '/billing' },
          { label: 'Invoices & Receipts' },
        ]}
      />

      <PageHeader
        title="Sales Invoices & Receipts"
        subtitle="Search, filter, reprint thermal/A4 receipts, or inspect detailed transaction audit logs."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<Filter size={16} />}
              disabled
            >
              Filter Records
            </Button>
            <Button
              variant="primary"
              leftIcon={<ShoppingCart size={16} />}
              onClick={() => navigate('/billing')}
            >
              Back to POS
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<Receipt size={48} />}
          title="Sales Invoice Archive"
          description="Historical sales bills, reprint options (thermal 80mm / standard A4), payment breakdowns, and cancellation records will be rendered in the Billing module."
        />
      </Card>
    </div>
  );
};
