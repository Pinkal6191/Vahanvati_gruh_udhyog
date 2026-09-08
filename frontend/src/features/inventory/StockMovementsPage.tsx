import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Package, Filter } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const StockMovementsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Inventory', path: '/inventory' },
          { label: 'Stock Movements' },
        ]}
      />

      <PageHeader
        title="Stock Movements & Ledger"
        subtitle="Complete audit trail of all inventory transactions: SALE, PRODUCTION, RETURN, ADJUSTMENT, and DAMAGE."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<Filter size={16} />}
              disabled
            >
              Filter Movements
            </Button>
            <Button
              variant="primary"
              leftIcon={<Package size={16} />}
              onClick={() => navigate('/inventory')}
            >
              Current Balances
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<ArrowLeftRight size={48} />}
          title="Stock Movement Ledger"
          description="Every stock increment and decrement is logged with reference type, batch number, previous balance, delta, and resulting balance."
        />
      </Card>
    </div>
  );
};
