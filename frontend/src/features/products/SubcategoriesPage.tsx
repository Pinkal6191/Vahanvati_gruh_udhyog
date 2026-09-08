import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTree, PlusCircle, FolderTree } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';

export const SubcategoriesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Products', path: '/products' },
          { label: 'Categories', path: '/categories' },
          { label: 'Subcategories' },
        ]}
      />

      <PageHeader
        title="Product Subcategories"
        subtitle="Manage detailed sub-groups linked to parent categories (e.g. Plain Khakhra, Methi Khakhra)."
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
            >
              Add Subcategory
            </Button>
          </div>
        }
      />

      <Card>
        <EmptyState
          icon={<ListTree size={48} />}
          title="Subcategories Management"
          description="Manage nested category hierarchies."
        />
      </Card>
    </div>
  );
};
