import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ChefHat } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const ProductionHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Production', path: '/production' },
          { label: 'Batch Records' },
        ]}
      />

      <PageHeader
        title="Production Batch Records"
        subtitle="Historical log of manufacturing batches, batch codes, pack distributions, and production operators."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<ChefHat size={16} />}
              onClick={() => navigate('/production')}
            >
              New Batch Entry
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<History size={48} />}
          title="Production History Archive"
          description="View all previous manufacturing runs with batch details and timestamp audits."
        />
      </Card>
    </div>
  );
};
