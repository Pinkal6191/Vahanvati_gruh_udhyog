import React from 'react';
import { Settings, Save, Printer } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const SettingsPage: React.FC = () => {
  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Store Settings' },
        ]}
      />

      <PageHeader
        title="Store & System Settings"
        subtitle="Configure store information, thermal printer settings, invoice prefixes, and system parameters."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<Printer size={16} />}
              disabled
            >
              Test Printer
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save size={16} />}
              disabled
            >
              Save Configuration
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<Settings size={48} />}
          title="System Settings"
          description="Manage store profile, GSTIN, receipt header/footer notes, and POS terminal configuration."
        />
      </Card>
    </div>
  );
};
