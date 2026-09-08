import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, History, Search } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const SalesReturnsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Sales Returns' },
        ]}
      />

      <PageHeader
        title="Sales Returns Terminal"
        subtitle="Lookup original invoices, select return items, choose refund method (CASH, UPI, CREDIT_NOTE), and auto-restock."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<History size={16} />}
              onClick={() => navigate('/sales-returns/history')}
            >
              Return History
            </Button>
            <Button
              variant="primary"
              leftIcon={<Search size={16} />}
              disabled
              title="Return wizard will be activated in subsequent step"
            >
              Lookup Invoice
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<RotateCcw size={48} />}
          title="Sales Return Engine (Step 8) Connected"
          description="The backend Sales Return Engine supports partial/full invoice returns, return quantity validation, unit price locking, stock auto-restock via centralized StockService, and Credit Note generation."
          action={{
            label: 'View Return History',
            onClick: () => navigate('/sales-returns/history'),
            variant: 'outline',
          }}
        />
      </Card>
    </div>
  );
};
