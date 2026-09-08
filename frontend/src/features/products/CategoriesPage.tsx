import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderTree, PlusCircle, ListTree } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Products', path: '/products' },
          { label: 'Categories' },
        ]}
      />

      <PageHeader
        title="Product Categories"
        subtitle="Organize product lines into high-level groups (e.g. Khakhra, Namkeen, Sweets)."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<ListTree size={16} />}
              onClick={() => navigate('/subcategories')}
            >
              Subcategories
            </Button>
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              disabled
            >
              Add Category
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<FolderTree size={48} />}
          title="Categories Management"
          description="Manage primary classifications for all catalog items."
        />
      </Card>
    </div>
  );
};
