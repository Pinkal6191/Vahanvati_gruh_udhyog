import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, History, PlusCircle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const ProductionPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Production Management' },
        ]}
      />

      <PageHeader
        title="Production Entry & Batches"
        subtitle="Log manufactured product batches, auto-generate batch numbers, specify packaging breakdowns, and auto-increment stock."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<History size={16} />}
              onClick={() => navigate('/production/history')}
            >
              Batch History
            </Button>
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              disabled
              title="Batch entry form will be activated in Production step"
            >
              Log Batch Entry
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<ChefHat size={48} />}
          title="Production Engine (Step 7) Connected"
          description="Direct integration with StockService ensuring that completed production runs immediately reflect in finished goods inventory."
          action={{
            label: 'View Batch History',
            onClick: () => navigate('/production/history'),
            variant: 'outline',
          }}
        />
      </Card>
    </div>
  );
};
