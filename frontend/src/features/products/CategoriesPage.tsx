import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, CheckCircle, XCircle, ListTree, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Modal } from '../../components/ui/Modal/Modal';
import { Input } from '../../components/forms/Input/Input';
import { Select } from '../../components/forms/Select/Select';
import { SearchInput } from '../../components/forms/SearchInput/SearchInput';
import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog/ConfirmationDialog';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import {
  CategoriesApi,
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../categories/categories.api';
import './master-data.css';

export const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Status Toggle Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    category: Category | null;
    nextStatus: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    category: null,
    nextStatus: false,
    isSubmitting: false,
  });

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await CategoriesApi.list({
        search: search.trim() || undefined,
        status: statusFilter,
      });
      setCategories(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load categories from local server.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCategories();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCategories]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormName('');
    setFormCode('');
    setFormDisplayOrder(0);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormCode(category.code);
    setFormDisplayOrder(category.displayOrder || 0);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Category name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Category code is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCategory) {
        const updatePayload: UpdateCategoryInput = {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          displayOrder: Number(formDisplayOrder),
        };
        await CategoriesApi.update(editingCategory.id, updatePayload);
        addToast({
          title: 'Category Updated',
          message: `Category "${formName}" updated successfully.`,
          variant: 'success',
        });
      } else {
        const createPayload: CreateCategoryInput = {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          displayOrder: Number(formDisplayOrder),
        };
        await CategoriesApi.create(createPayload);
        addToast({
          title: 'Category Created',
          message: `Category "${formName}" created successfully.`,
          variant: 'success',
        });
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save category.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Status Confirmation Dialog
  const handlePromptStatusToggle = (category: Category) => {
    setConfirmDialog({
      isOpen: true,
      category,
      nextStatus: !category.isActive,
      isSubmitting: false,
    });
  };

  // Confirm Status Toggle
  const handleConfirmStatusToggle = async () => {
    if (!confirmDialog.category) return;
    setConfirmDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await CategoriesApi.updateStatus(confirmDialog.category.id, confirmDialog.nextStatus);
      addToast({
        title: 'Status Updated',
        message: `Category "${confirmDialog.category.name}" is now ${
          confirmDialog.nextStatus ? 'active' : 'inactive'
        }.`,
        variant: 'success',
      });
      setConfirmDialog({ isOpen: false, category: null, nextStatus: false, isSubmitting: false });
      loadCategories();
    } catch (err: any) {
      addToast({
        title: 'Status Change Failed',
        message: err?.message || 'Failed to toggle category status.',
        variant: 'error',
      });
      setConfirmDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const columns: ColumnDef<Category>[] = [
    {
      key: 'name',
      header: 'Category Name',
      cell: (row) => (
        <div className="table-primary-info">
          <span className="info-title">{row.name}</span>
          <span className="info-subtitle">Code: {row.code}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      width: '140px',
      cell: (row) => <span className="mono-badge">{row.code}</span>,
    },
    {
      key: 'displayOrder',
      header: 'Order',
      width: '90px',
      align: 'center',
      cell: (row) => <span>{row.displayOrder}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created On',
      width: '140px',
      cell: (row) => <span className="date-text">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '150px',
      align: 'right',
      cell: (row) => (
        <div className="table-action-buttons">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            title="Edit category"
          >
            <Edit2 size={15} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handlePromptStatusToggle(row);
            }}
            title={row.isActive ? 'Deactivate category' : 'Activate category'}
          >
            {row.isActive ? (
              <XCircle size={15} className="text-danger" />
            ) : (
              <CheckCircle size={15} className="text-success" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="master-data-page">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Products', path: '/products' },
          { label: 'Categories' },
        ]}
      />

      <PageHeader
        title="Product Categories"
        subtitle="Manage product categories and organize product lines."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<ListTree size={16} />}
              onClick={() => navigate('/subcategories')}
            >
              Manage Subcategories
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenAdd}
            >
              Add Category
            </Button>
          </div>
        }
      />

      {/* FILTERS BAR */}
      <div className="master-filters-card">
        <div className="master-filters-grid">
          <SearchInput
            placeholder="Search category by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="filter-search-input"
          />

          <Select
            label=""
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
            ]}
            className="filter-select-input"
          />

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={loadCategories}
            className="filter-refresh-btn"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Could Not Load Categories"
          message={error}
          onRetry={loadCategories}
        />
      )}

      {/* DATA TABLE */}
      {!error && (
        <DataTable
          columns={columns}
          data={categories}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No categories found. Click 'Add Category' to create your first category."
        />
      )}

      {/* ADD / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingCategory ? `Edit Category: ${editingCategory.name}` : 'Add New Category'}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitForm}
              isLoading={isSaving}
            >
              {editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitForm} className="modal-form-vertical">
          {formError && (
            <div className="form-error-banner" role="alert">
              {formError}
            </div>
          )}

          <Input
            label="Category Name"
            id="categoryName"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Khakhra"
            isRequired
            autoFocus
          />

          <Input
            label="Category Code"
            id="categoryCode"
            type="text"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
            placeholder="e.g. KHAKHRA"
            isRequired
            helperText="Short uppercase code used for identification"
          />

          <Input
            label="Display Order"
            id="displayOrder"
            type="number"
            value={formDisplayOrder}
            onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
            helperText="Lower numbers appear first in lists"
          />
        </form>
      </Modal>

      {/* CONFIRMATION DIALOG FOR STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, category: null, nextStatus: false, isSubmitting: false })}
        onConfirm={handleConfirmStatusToggle}
        title={confirmDialog.nextStatus ? 'Activate Category' : 'Deactivate Category'}
        message={
          confirmDialog.nextStatus ? (
            `Are you sure you want to activate "${confirmDialog.category?.name}"? It will become visible in catalogs.`
          ) : (
            `Are you sure you want to deactivate "${confirmDialog.category?.name}"? Items under this category will no longer be available for new sales.`
          )
        }
        confirmText={confirmDialog.nextStatus ? 'Activate' : 'Deactivate'}
        variant={confirmDialog.nextStatus ? 'primary' : 'danger'}
        isLoading={confirmDialog.isSubmitting}
      />
    </div>
  );
};
