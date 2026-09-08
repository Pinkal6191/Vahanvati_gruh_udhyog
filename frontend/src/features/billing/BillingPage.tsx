import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, History, PlusCircle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const BillingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Point of Sale (Billing)' },
        ]}
      />

      <PageHeader
        title="Point of Sale (POS)"
        subtitle="Fast multi-item billing terminal with Indian/NRI pricing, stock checks, and barcode/search support."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<History size={16} />}
              onClick={() => navigate('/billing/history')}
            >
              Invoice History
            </Button>
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              disabled
              title="Full interactive POS screen will be activated in Step 11"
            >
              New Bill (F2)
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<ShoppingCart size={48} />}
          title="POS Terminal Ready for Step 11"
          description="The backend Billing Engine (Step 5) is fully implemented with atomic stock reservation, multi-mode payments (CASH, UPI, CARD, CREDIT), and invoice generation. The dedicated POS touchscreen and thermal print interface will be built in Step 11."
          action={{
            label: 'View Invoices Archive',
            onClick: () => navigate('/billing/history'),
            variant: 'outline',
          }}
        />
      </Card>
    </div>
  );
};
