import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tags, PlusCircle, FolderTree } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Products Catalog' },
        ]}
      />

      <PageHeader
        title="Products & Pack Variants"
        subtitle="Manage product definitions, bilingual names (English & Gujarati), pack sizes, weights, and Indian/NRI pricing."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<FolderTree size={16} />}
              onClick={() => navigate('/categories')}
            >
              Categories
            </Button>
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              disabled
              title="Product creation modal available in Catalog step"
            >
              Add Product
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<Tags size={48} />}
          title="Product Master Catalog Ready"
          description="Backend products, packaging configurations, and tiered pricing engine (Step 4) are fully configured and ready to supply item lists."
        />
      </Card>
    </div>
  );
};
