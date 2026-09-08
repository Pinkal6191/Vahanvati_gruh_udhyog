import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const StockPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Inventory & Stock' },
        ]}
      />

      <PageHeader
        title="Stock & Inventory Status"
        subtitle="Real-time stock balances across all product packs, low-stock alerts, and manual inventory adjustments."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<ArrowLeftRight size={16} />}
              onClick={() => navigate('/inventory/movements')}
            >
              Movement Ledger
            </Button>
            <Button
              variant="secondary"
              leftIcon={<SlidersHorizontal size={16} />}
              disabled
              title="Stock adjustments available in Inventory step"
            >
              Stock Adjustment
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<Package size={48} />}
          title="Centralized Stock Engine (Step 6) Online"
          description="Atomic stock reservation, concurrency locking, unit conversions, and low stock threshold alerts are operational on the backend."
          action={{
            label: 'View Stock Movements',
            onClick: () => navigate('/inventory/movements'),
            variant: 'outline',
          }}
        />
      </Card>
    </div>
  );
};
