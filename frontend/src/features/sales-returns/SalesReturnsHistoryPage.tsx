import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const SalesReturnsHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Sales Returns', path: '/sales-returns' },
          { label: 'Returns History' },
        ]}
      />

      <PageHeader
        title="Sales Returns History"
        subtitle="Audit log of all return transactions, refund amounts, restocked quantities, and credit notes."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<RotateCcw size={16} />}
              onClick={() => navigate('/sales-returns')}
            >
              New Sales Return
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<History size={48} />}
          title="Sales Return Audit History"
          description="Complete record of processed returns, approval tracking, and credit note statuses."
        />
      </Card>
    </div>
  );
};
