import React from 'react';
import { Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const WebsitePage: React.FC = () => {
  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Website Management' },
        ]}
      />

      <PageHeader
        title="Public Website & Catalog"
        subtitle="Manage public-facing product listings, banners, announcements, and customer contact inquiries."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<RefreshCw size={16} />}
              disabled
            >
              Sync Catalog
            </Button>
            <Button
              variant="primary"
              leftIcon={<ExternalLink size={16} />}
              disabled
            >
              Preview Website
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<Globe size={48} />}
          title="Website Administration"
          description="Control public catalog visibility, hero banners, and company contact details."
        />
      </Card>
    </div>
  );
};
