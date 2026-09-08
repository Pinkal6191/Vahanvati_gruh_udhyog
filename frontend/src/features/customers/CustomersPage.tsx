import React from 'react';
import { Users, UserPlus, Filter } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const CustomersPage: React.FC = () => {
  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Customer Directory' },
        ]}
      />

      <PageHeader
        title="Customer Directory"
        subtitle="Manage customer profiles, Indian vs. NRI classification, phone numbers, and address details."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<Filter size={16} />}
              disabled
            >
              Filter
            </Button>
            <Button
              variant="primary"
              leftIcon={<UserPlus size={16} />}
              disabled
              title="Customer form will be activated in subsequent step"
            >
              Add Customer
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<Users size={48} />}
          title="Customer Master Data Ready"
          description="Backend customer APIs (Step 3) are active with automatic INDIAN / NRI classification, mobile number uniqueness, and purchase history tracking."
        />
      </Card>
    </div>
  );
};
