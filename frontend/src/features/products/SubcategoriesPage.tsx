import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, CheckCircle, XCircle, FolderTree, RefreshCw } from 'lucide-react';
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
  SubcategoriesApi,
  Subcategory,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
} from '../subcategories/subcategories.api';
import { CategoriesApi, Category } from '../categories/categories.api';
import './master-data.css';

export const SubcategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Status Toggle Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    subcategory: Subcategory | null;
    nextStatus: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    subcategory: null,
    nextStatus: false,
    isSubmitting: false,
  });

  // Load Parent Categories for dropdowns
  const loadParentCategories = useCallback(async () => {
    try {
      const cats = await CategoriesApi.list({ status: 'active' });
      setCategories(cats);
    } catch (err) {
      console.warn('Failed to load categories for dropdown:', err);
    }
  }, []);

  const loadSubcategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await SubcategoriesApi.list({
        categoryId: selectedCategoryFilter || undefined,
        search: search.trim() || undefined,
        status: statusFilter,
      });
      setSubcategories(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load subcategories from local server.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategoryFilter, search, statusFilter]);

  useEffect(() => {
    loadParentCategories();
  }, [loadParentCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSubcategories();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadSubcategories]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingSubcategory(null);
    setFormCategoryId(selectedCategoryFilter || (categories[0]?.id || ''));
    setFormName('');
    setFormCode('');
    setFormDisplayOrder(0);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (subcat: Subcategory) => {
    setEditingSubcategory(subcat);
    setFormCategoryId(subcat.categoryId);
    setFormName(subcat.name);
    setFormCode(subcat.code);
    setFormDisplayOrder(subcat.displayOrder || 0);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formCategoryId) {
      setFormError('Please select a parent category.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Subcategory name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Subcategory code is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingSubcategory) {
        const updatePayload: UpdateSubcategoryInput = {
          categoryId: formCategoryId,
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          displayOrder: Number(formDisplayOrder),
        };
        await SubcategoriesApi.update(editingSubcategory.id, updatePayload);
        addToast({
          title: 'Subcategory Updated',
          message: `Subcategory "${formName}" updated successfully.`,
          variant: 'success',
        });
      } else {
        const createPayload: CreateSubcategoryInput = {
          categoryId: formCategoryId,
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          displayOrder: Number(formDisplayOrder),
        };
        await SubcategoriesApi.create(createPayload);
        addToast({
          title: 'Subcategory Created',
          message: `Subcategory "${formName}" created successfully.`,
          variant: 'success',
        });
      }
      setIsModalOpen(false);
      loadSubcategories();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save subcategory.');
    } finally {
      setIsSaving(false);
    }
  };

  // Status Toggle
  const handlePromptStatusToggle = (subcat: Subcategory) => {
    setConfirmDialog({
      isOpen: true,
      subcategory: subcat,
      nextStatus: !subcat.isActive,
      isSubmitting: false,
    });
  };

  const handleConfirmStatusToggle = async () => {
    if (!confirmDialog.subcategory) return;
    setConfirmDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await SubcategoriesApi.updateStatus(confirmDialog.subcategory.id, confirmDialog.nextStatus);
      addToast({
        title: 'Status Updated',
        message: `Subcategory "${confirmDialog.subcategory.name}" is now ${
          confirmDialog.nextStatus ? 'active' : 'inactive'
        }.`,
        variant: 'success',
      });
      setConfirmDialog({ isOpen: false, subcategory: null, nextStatus: false, isSubmitting: false });
      loadSubcategories();
    } catch (err: any) {
      addToast({
        title: 'Status Change Failed',
        message: err?.message || 'Failed to toggle subcategory status.',
        variant: 'error',
      });
      setConfirmDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const columns: ColumnDef<Subcategory>[] = [
    {
      key: 'name',
      header: 'Subcategory Name',
      cell: (row) => (
        <div className="table-primary-info">
          <span className="info-title">{row.name}</span>
          <span className="info-subtitle">Code: {row.code}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Parent Category',
      width: '180px',
      cell: (row) => (
        <Badge variant="brand" size="sm">
          {row.category?.name || 'Category'}
        </Badge>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      width: '130px',
      cell: (row) => <span className="mono-badge">{row.code}</span>,
    },
    {
      key: 'displayOrder',
      header: 'Order',
      width: '80px',
      align: 'center',
      cell: (row) => <span>{row.displayOrder}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created On',
      width: '130px',
      cell: (row) => <span className="date-text">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
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
      width: '140px',
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
            title="Edit subcategory"
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
            title={row.isActive ? 'Deactivate subcategory' : 'Activate subcategory'}
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

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="master-data-page">
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
        subtitle="Manage detailed subcategories and link them to parent categories."
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
              leftIcon={<Plus size={16} />}
              onClick={handleOpenAdd}
            >
              Add Subcategory
            </Button>
          </div>
        }
      />

      {/* FILTERS BAR */}
      <div className="master-filters-card">
        <div className="master-filters-grid">
          <SearchInput
            placeholder="Search subcategory by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="filter-search-input"
          />

          <Select
            label=""
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            options={categoryOptions}
            className="filter-select-input"
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
            onClick={loadSubcategories}
            className="filter-refresh-btn"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Could Not Load Subcategories"
          message={error}
          onRetry={loadSubcategories}
        />
      )}

      {/* DATA TABLE */}
      {!error && (
        <DataTable
          columns={columns}
          data={subcategories}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No subcategories found. Select a category or click 'Add Subcategory' to create one."
        />
      )}

      {/* ADD / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingSubcategory ? `Edit Subcategory: ${editingSubcategory.name}` : 'Add New Subcategory'}
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
              {editingSubcategory ? 'Update Subcategory' : 'Create Subcategory'}
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

          <Select
            label="Parent Category"
            id="parentCategory"
            value={formCategoryId}
            onChange={(e) => setFormCategoryId(e.target.value)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            isRequired
            helperText="Category to which this subcategory belongs"
          />

          <Input
            label="Subcategory Name"
            id="subcatName"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Plain Khakhra"
            isRequired
          />

          <Input
            label="Subcategory Code"
            id="subcatCode"
            type="text"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
            placeholder="e.g. KHAKHRA_PLAIN"
            isRequired
            helperText="Uppercase alphanumeric code"
          />

          <Input
            label="Display Order"
            id="subcatOrder"
            type="number"
            value={formDisplayOrder}
            onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
            helperText="Lower numbers appear first"
          />
        </form>
      </Modal>

      {/* CONFIRMATION DIALOG FOR STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, subcategory: null, nextStatus: false, isSubmitting: false })}
        onConfirm={handleConfirmStatusToggle}
        title={confirmDialog.nextStatus ? 'Activate Subcategory' : 'Deactivate Subcategory'}
        message={
          confirmDialog.nextStatus ? (
            `Are you sure you want to activate "${confirmDialog.subcategory?.name}"?`
          ) : (
            `Are you sure you want to deactivate "${confirmDialog.subcategory?.name}"? Products under this subcategory will not be available for selection.`
          )
        }
        confirmText={confirmDialog.nextStatus ? 'Activate' : 'Deactivate'}
        variant={confirmDialog.nextStatus ? 'primary' : 'danger'}
        isLoading={confirmDialog.isSubmitting}
      />
    </div>
  );
};
