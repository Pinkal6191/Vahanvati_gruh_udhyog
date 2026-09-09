import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  FolderTree,
  ListTree,
  RefreshCw,
  Tags,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { DataTable, ColumnDef } from '../../components/tables/DataTable/DataTable';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Modal } from '../../components/ui/Modal/Modal';
import { Input } from '../../components/forms/Input/Input';
import { Select } from '../../components/forms/Select/Select';
import { SearchInput } from '../../components/forms/SearchInput/SearchInput';
import { Switch } from '../../components/forms/Switch/Switch';
import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog/ConfirmationDialog';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { useToast } from '../../hooks/useToast';
import { formatCurrency, formatGramsToKg } from '../../utils/formatters';
import {
  ProductsApi,
  Product,
  Unit,
  CreateProductInput,
  UpdateProductInput,
} from './products.api';
import { CategoriesApi, Category } from '../categories/categories.api';
import { SubcategoriesApi, Subcategory } from '../subcategories/subcategories.api';
import './master-data.css';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(15);

  const [search, setSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formGujaratiName, setFormGujaratiName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formSubcategoryId, setFormSubcategoryId] = useState<string>('');
  const [formPrimaryUnitId, setFormPrimaryUnitId] = useState<string>('');
  const [formMinThreshold, setFormMinThreshold] = useState<number>(0);
  const [formIsLooseAllowed, setFormIsLooseAllowed] = useState<boolean>(true);
  const [formIndianPrice, setFormIndianPrice] = useState<string>('');
  const [formNriPrice, setFormNriPrice] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Status Toggle Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    product: Product | null;
    nextStatus: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    product: null,
    nextStatus: false,
    isSubmitting: false,
  });

  // Load Categories, Subcategories, Units for dropdowns
  const loadLookups = useCallback(async () => {
    try {
      const [cats, subcats, unitList] = await Promise.all([
        CategoriesApi.list({ status: 'active' }),
        SubcategoriesApi.list({ status: 'active' }),
        ProductsApi.fetchUnits(),
      ]);
      setCategories(cats);
      setSubcategories(subcats);
      setUnits(unitList);
    } catch (err) {
      console.warn('Failed to load lookup data:', err);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ProductsApi.list({
        search: search.trim() || undefined,
        categoryId: selectedCategoryFilter || undefined,
        subcategoryId: selectedSubcategoryFilter || undefined,
        status: statusFilter,
        page,
        limit,
      });

      const items = response?.items || [];

      // Resolve prices for items
      const itemsWithPrices = await Promise.all(
        items.map(async (prod) => {
          const prices = await ProductsApi.fetchProductPrices(prod.id);
          return {
            ...prod,
            indianPrice: prices.indian ?? null,
            nriPrice: prices.nri ?? null,
          };
        })
      );

      setProducts(itemsWithPrices);
      setTotal(response?.pagination?.total || 0);
      setTotalPages(response?.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load products from local server.');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategoryFilter, selectedSubcategoryFilter, statusFilter, page, limit]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  // Dependent subcategories for modal form
  const modalFilteredSubcategories = subcategories.filter(
    (s) => !formCategoryId || s.categoryId === formCategoryId
  );

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingProduct(null);
    const defaultCat = categories[0]?.id || '';
    setFormCategoryId(defaultCat);
    const availableSubcats = subcategories.filter((s) => s.categoryId === defaultCat);
    setFormSubcategoryId(availableSubcats[0]?.id || subcategories[0]?.id || '');
    setFormPrimaryUnitId(units[0]?.id || '');
    setFormName('');
    setFormGujaratiName('');
    setFormCode('');
    setFormBarcode('');
    setFormMinThreshold(0);
    setFormIsLooseAllowed(true);
    setFormIndianPrice('');
    setFormNriPrice('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = async (product: Product) => {
    setEditingProduct(product);
    const catId = product.subcategory?.categoryId || '';
    setFormCategoryId(catId);
    setFormSubcategoryId(product.subcategoryId);
    setFormPrimaryUnitId(product.primaryUnitId);
    setFormName(product.name);
    setFormGujaratiName(product.gujaratiName || '');
    setFormCode(product.code);
    setFormBarcode(product.barcode || '');
    setFormMinThreshold(product.stock?.minimumThreshold || 0);
    setFormIsLooseAllowed(product.isLooseWeightAllowed);
    setFormIndianPrice(product.indianPrice ? String(product.indianPrice) : '');
    setFormNriPrice(product.nriPrice ? String(product.nriPrice) : '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Product code is required.');
      return;
    }
    if (!formSubcategoryId) {
      setFormError('Subcategory is required.');
      return;
    }
    if (!formPrimaryUnitId) {
      setFormError('Primary Unit is required.');
      return;
    }

    const indianRate = formIndianPrice ? parseFloat(formIndianPrice) : undefined;
    const nriRate = formNriPrice ? parseFloat(formNriPrice) : undefined;

    if (indianRate !== undefined && (isNaN(indianRate) || indianRate <= 0)) {
      setFormError('Indian price must be a valid positive number.');
      return;
    }
    if (nriRate !== undefined && (isNaN(nriRate) || nriRate <= 0)) {
      setFormError('NRI price must be a valid positive number.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingProduct) {
        const updatePayload: UpdateProductInput = {
          categoryId: formCategoryId || undefined,
          subcategoryId: formSubcategoryId,
          primaryUnitId: formPrimaryUnitId,
          name: formName.trim(),
          gujaratiName: formGujaratiName.trim() || undefined,
          code: formCode.trim().toUpperCase(),
          barcode: formBarcode.trim() || undefined,
          isLooseWeightAllowed: formIsLooseAllowed,
          minimumStockThreshold: Number(formMinThreshold),
          indianPrice: indianRate,
          nriPrice: nriRate,
        };
        await ProductsApi.update(editingProduct.id, updatePayload);
        addToast({
          title: 'Product Updated',
          message: `Product "${formName}" updated successfully.`,
          variant: 'success',
        });
      } else {
        const createPayload: CreateProductInput = {
          categoryId: formCategoryId || undefined,
          subcategoryId: formSubcategoryId,
          primaryUnitId: formPrimaryUnitId,
          name: formName.trim(),
          gujaratiName: formGujaratiName.trim() || undefined,
          code: formCode.trim().toUpperCase(),
          barcode: formBarcode.trim() || undefined,
          isLooseWeightAllowed: formIsLooseAllowed,
          minimumStockThreshold: Number(formMinThreshold),
          indianPrice: indianRate,
          nriPrice: nriRate,
        };
        await ProductsApi.create(createPayload);
        addToast({
          title: 'Product Created',
          message: `Product "${formName}" created successfully with initial pricing.`,
          variant: 'success',
        });
      }
      setIsModalOpen(false);
      loadProducts();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save product.');
    } finally {
      setIsSaving(false);
    }
  };

  // Status Toggle
  const handlePromptStatusToggle = (product: Product) => {
    setConfirmDialog({
      isOpen: true,
      product,
      nextStatus: !product.isActive,
      isSubmitting: false,
    });
  };

  const handleConfirmStatusToggle = async () => {
    if (!confirmDialog.product) return;
    setConfirmDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await ProductsApi.updateStatus(confirmDialog.product.id, confirmDialog.nextStatus);
      addToast({
        title: 'Status Updated',
        message: `Product "${confirmDialog.product.name}" is now ${
          confirmDialog.nextStatus ? 'active' : 'inactive'
        }.`,
        variant: 'success',
      });
      setConfirmDialog({ isOpen: false, product: null, nextStatus: false, isSubmitting: false });
      loadProducts();
    } catch (err: any) {
      addToast({
        title: 'Status Change Failed',
        message: err?.message || 'Failed to toggle product status.',
        variant: 'error',
      });
      setConfirmDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const columns: ColumnDef<Product>[] = [
    {
      key: 'name',
      header: 'Product Name',
      cell: (row) => (
        <div className="table-primary-info">
          <span className="info-title">{row.name}</span>
          {row.gujaratiName && <span className="gujarati-name">{row.gujaratiName}</span>}
          <span className="info-subtitle">Code: {row.code}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category / Subcat',
      width: '180px',
      cell: (row) => (
        <div className="table-primary-info">
          <span className="info-title">{row.subcategory?.category?.name || '-'}</span>
          <span className="info-subtitle">{row.subcategory?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'indianPrice',
      header: 'Indian Price',
      width: '120px',
      cell: (row) => (
        <span className="price-text">
          {row.indianPrice !== null && row.indianPrice !== undefined
            ? formatCurrency(row.indianPrice)
            : '—'}
        </span>
      ),
    },
    {
      key: 'nriPrice',
      header: 'NRI Price',
      width: '120px',
      cell: (row) => (
        <span className="price-text" style={{ color: 'var(--color-primary-800)' }}>
          {row.nriPrice !== null && row.nriPrice !== undefined
            ? formatCurrency(row.nriPrice)
            : '—'}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock / Unit',
      width: '140px',
      cell: (row) => {
        const balance = row.stock?.currentBalance || 0;
        const symbol = row.primaryUnit?.symbol || 'GM';
        return (
          <div className="table-primary-info">
            <span className="info-title">
              {symbol.toUpperCase() === 'GM' ? formatGramsToKg(balance) : `${balance} ${symbol}`}
            </span>
            <span className="info-subtitle">Unit: {symbol}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
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
      width: '120px',
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
            title="Edit product"
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
            title={row.isActive ? 'Deactivate product' : 'Activate product'}
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
          { label: 'Products Catalog' },
        ]}
      />

      <PageHeader
        title="Products Catalog"
        subtitle="Manage product definitions, bilingual names (English/Gujarati), packaging units, and Indian/NRI prices."
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
              variant="outline"
              leftIcon={<ListTree size={16} />}
              onClick={() => navigate('/subcategories')}
            >
              Subcategories
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenAdd}
            >
              Add Product
            </Button>
          </div>
        }
      />

      {/* FILTERS BAR */}
      <div className="master-filters-card">
        <div className="master-filters-grid">
          <SearchInput
            placeholder="Search product by name, code, barcode..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearch('');
              setPage(1);
            }}
            className="filter-search-input"
          />

          <Select
            label=""
            value={selectedCategoryFilter}
            onChange={(e) => {
              setSelectedCategoryFilter(e.target.value);
              setSelectedSubcategoryFilter('');
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            className="filter-select-input"
          />

          <Select
            label=""
            value={selectedSubcategoryFilter}
            onChange={(e) => {
              setSelectedSubcategoryFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Subcategories' },
              ...subcategories
                .filter((s) => !selectedCategoryFilter || s.categoryId === selectedCategoryFilter)
                .map((s) => ({ value: s.id, label: s.name })),
            ]}
            className="filter-select-input"
          />

          <Select
            label=""
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
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
            onClick={loadProducts}
            className="filter-refresh-btn"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Could Not Load Products"
          message={error}
          onRetry={loadProducts}
        />
      )}

      {/* DATA TABLE */}
      {!error && (
        <DataTable
          columns={columns}
          data={products}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No products found matching the criteria. Click 'Add Product' to create one."
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={(newPage) => setPage(newPage)}
        />
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product'}
        size="lg"
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
              {editingProduct ? 'Update Product' : 'Create Product'}
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

          <div className="modal-form-row">
            <Input
              label="Product Name (English)"
              id="productName"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Sada Khakhra"
              isRequired
              autoFocus
            />

            <Input
              label="Product Name (Gujarati)"
              id="productGujarati"
              type="text"
              value={formGujaratiName}
              onChange={(e) => setFormGujaratiName(e.target.value)}
              placeholder="e.g. સાદા ખાખરા"
              helperText="Renders in Noto Sans Gujarati"
            />
          </div>

          <div className="modal-form-row">
            <Input
              label="Product Code"
              id="productCode"
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="e.g. KHAKHRA_SADA"
              isRequired
              helperText="Unique uppercase identifier"
            />

            <Input
              label="Barcode / SKU"
              id="productBarcode"
              type="text"
              value={formBarcode}
              onChange={(e) => setFormBarcode(e.target.value)}
              placeholder="e.g. 8901234567890"
              helperText="Optional barcode for scanner"
            />
          </div>

          <div className="modal-form-row">
            <Select
              label="Parent Category"
              id="prodCategory"
              value={formCategoryId}
              onChange={(e) => {
                setFormCategoryId(e.target.value);
                const subcats = subcategories.filter((s) => s.categoryId === e.target.value);
                setFormSubcategoryId(subcats[0]?.id || '');
              }}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              isRequired
            />

            <Select
              label="Subcategory"
              id="prodSubcategory"
              value={formSubcategoryId}
              onChange={(e) => setFormSubcategoryId(e.target.value)}
              options={modalFilteredSubcategories.map((s) => ({ value: s.id, label: s.name }))}
              isRequired
            />
          </div>

          <div className="modal-form-row">
            <Select
              label="Primary Measurement Unit"
              id="prodUnit"
              value={formPrimaryUnitId}
              onChange={(e) => setFormPrimaryUnitId(e.target.value)}
              options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
              isRequired
            />

            <Input
              label="Min Stock Alert Threshold"
              id="prodThreshold"
              type="number"
              value={formMinThreshold}
              onChange={(e) => setFormMinThreshold(Number(e.target.value))}
              helperText="Alerts when stock falls below this quantity"
            />
          </div>

          <div className="modal-form-row">
            <Input
              label="Indian Price (₹)"
              id="prodIndianPrice"
              type="number"
              step="0.01"
              value={formIndianPrice}
              onChange={(e) => setFormIndianPrice(e.target.value)}
              placeholder="e.g. 150.00"
              helperText="Base selling rate for Indian customers"
            />

            <Input
              label="NRI Price (₹)"
              id="prodNriPrice"
              type="number"
              step="0.01"
              value={formNriPrice}
              onChange={(e) => setFormNriPrice(e.target.value)}
              placeholder="e.g. 220.00"
              helperText="Special export rate for NRI customers"
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <Switch
              label="Allow Loose Weight Selling"
              description="Permits weighing in fractions (e.g. 350g) at POS terminal"
              checked={formIsLooseAllowed}
              onChange={(e) => setFormIsLooseAllowed(e.target.checked)}
            />
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION DIALOG FOR STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, product: null, nextStatus: false, isSubmitting: false })}
        onConfirm={handleConfirmStatusToggle}
        title={confirmDialog.nextStatus ? 'Activate Product' : 'Deactivate Product'}
        message={
          confirmDialog.nextStatus ? (
            `Are you sure you want to activate "${confirmDialog.product?.name}"? It will become available for billing immediately.`
          ) : (
            `Are you sure you want to deactivate "${confirmDialog.product?.name}"? It will be hidden from the active POS billing screen.`
          )
        }
        confirmText={confirmDialog.nextStatus ? 'Activate' : 'Deactivate'}
        variant={confirmDialog.nextStatus ? 'primary' : 'danger'}
        isLoading={confirmDialog.isSubmitting}
      />
    </div>
  );
};
