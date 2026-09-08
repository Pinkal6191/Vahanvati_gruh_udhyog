import React from 'react';
import { UserCog, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const UsersPage: React.FC = () => {
  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'User Management' },
        ]}
      />

      <PageHeader
        title="User & Staff Administration"
        subtitle="Manage user accounts, credentials, and role assignments (ADMIN, OUTLET, PRODUCTION)."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<UserPlus size={16} />}
              disabled
            >
              Add User
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<UserCog size={48} />}
          title="Role-Based User Management"
          description="Enforce RBAC boundaries across ADMIN, OUTLET, and PRODUCTION roles with bcrypt hashing and JWT tokens."
        />
      </Card>
    </div>
  );
};
