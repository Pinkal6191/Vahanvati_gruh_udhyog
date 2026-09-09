import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  History,
  RefreshCw,
  Phone,
  FileText,
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
import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog/ConfirmationDialog';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { useToast } from '../../hooks/useToast';
import { formatIndianMobile } from '../../utils/formatters';
import {
  CustomersApi,
  Customer,
  CustomerType,
  CreateCustomerInput,
  UpdateCustomerInput,
} from './customers.api';
import '../products/master-data.css';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(15);

  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formMobile, setFormMobile] = useState<string>('');
  const [formCustomerType, setFormCustomerType] = useState<CustomerType>('INDIAN');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formCountry, setFormCountry] = useState<string>('India');
  const [formGstin, setFormGstin] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Status Toggle Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    customer: Customer | null;
    nextStatus: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    customer: null,
    nextStatus: false,
    isSubmitting: false,
  });

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await CustomersApi.list({
        search: search.trim() || undefined,
        type: typeFilter ? (typeFilter as CustomerType) : undefined,
        status: statusFilter,
        page,
        limit,
      });
      setCustomers(response?.items || []);
      setTotal(response?.pagination?.total || 0);
      setTotalPages(response?.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load customers from local server.');
    } finally {
      setIsLoading(false);
    }
  }, [search, typeFilter, statusFilter, page, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormMobile('');
    setFormCustomerType('INDIAN');
    setFormEmail('');
    setFormAddress('');
    setFormCity('');
    setFormCountry('India');
    setFormGstin('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormMobile(customer.mobile || '');
    setFormCustomerType(customer.customerType);
    setFormEmail(customer.email || '');
    setFormAddress(customer.address || '');
    setFormCity(customer.city || '');
    setFormCountry(customer.country || 'India');
    setFormGstin(customer.gstin || '');
    setFormNotes(customer.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    if (formMobile.trim() && !/^[0-9+ ]{7,16}$/.test(formMobile.trim())) {
      setFormError('Mobile number format is invalid.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCustomer) {
        const updatePayload: UpdateCustomerInput = {
          name: formName.trim(),
          customerType: formCustomerType,
          mobile: formMobile.trim() || null,
          email: formEmail.trim() || null,
          address: formAddress.trim() || null,
          city: formCity.trim() || null,
          country: formCountry.trim() || 'India',
          gstin: formGstin.trim() || null,
          notes: formNotes.trim() || null,
        };
        await CustomersApi.update(editingCustomer.id, updatePayload);
        addToast({
          title: 'Customer Updated',
          message: `Customer "${formName}" updated successfully.`,
          variant: 'success',
        });
      } else {
        const createPayload: CreateCustomerInput = {
          name: formName.trim(),
          customerType: formCustomerType,
          mobile: formMobile.trim() || null,
          email: formEmail.trim() || null,
          address: formAddress.trim() || null,
          city: formCity.trim() || null,
          country: formCountry.trim() || 'India',
          gstin: formGstin.trim() || null,
          notes: formNotes.trim() || null,
        };
        await CustomersApi.create(createPayload);
        addToast({
          title: 'Customer Added',
          message: `Customer "${formName}" added successfully as ${formCustomerType}.`,
          variant: 'success',
        });
      }
      setIsModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save customer.');
    } finally {
      setIsSaving(false);
    }
  };

  // Status Toggle
  const handlePromptStatusToggle = (customer: Customer) => {
    setConfirmDialog({
      isOpen: true,
      customer,
      nextStatus: !customer.isActive,
      isSubmitting: false,
    });
  };

  const handleConfirmStatusToggle = async () => {
    if (!confirmDialog.customer) return;
    setConfirmDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await CustomersApi.updateStatus(confirmDialog.customer.id, confirmDialog.nextStatus);
      addToast({
        title: 'Status Updated',
        message: `Customer "${confirmDialog.customer.name}" is now ${
          confirmDialog.nextStatus ? 'active' : 'inactive'
        }.`,
        variant: 'success',
      });
      setConfirmDialog({ isOpen: false, customer: null, nextStatus: false, isSubmitting: false });
      loadCustomers();
    } catch (err: any) {
      addToast({
        title: 'Status Change Failed',
        message: err?.message || 'Failed to toggle customer status.',
        variant: 'error',
      });
      setConfirmDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const columns: ColumnDef<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      cell: (row) => (
        <div className="table-primary-info">
          <span className="info-title">{row.name}</span>
          {row.city && <span className="info-subtitle">{row.city}, {row.country || 'India'}</span>}
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      width: '160px',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Phone size={13} style={{ color: 'var(--color-gray-400)' }} />
          <span className="mono-badge">{formatIndianMobile(row.mobile)}</span>
        </div>
      ),
    },
    {
      key: 'customerType',
      header: 'Customer Type',
      width: '140px',
      cell: (row) => (
        <Badge variant={row.customerType === 'NRI' ? 'brand' : 'neutral'} size="sm">
          {row.customerType === 'NRI' ? 'NRI (Export)' : 'INDIAN (Local)'}
        </Badge>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      width: '150px',
      cell: (row) => (
        <span className="mono-badge" style={{ backgroundColor: 'transparent' }}>
          {row.gstin || '—'}
        </span>
      ),
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
      width: '150px',
      align: 'right',
      cell: (row) => (
        <div className="table-action-buttons">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/customers/${row.id}`);
            }}
            title="View customer purchase history"
          >
            <History size={15} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            title="Edit customer details"
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
            title={row.isActive ? 'Deactivate customer' : 'Activate customer'}
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
          { label: 'Customer Directory' },
        ]}
      />

      <PageHeader
        title="Customer Directory"
        subtitle="Manage customer profiles, Indian vs NRI pricing classification, contact information, and purchase history."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenAdd}
            >
              Add Customer
            </Button>
          </div>
        }
      />

      {/* FILTERS BAR */}
      <div className="master-filters-card">
        <div className="master-filters-grid">
          <SearchInput
            placeholder="Search by customer name, mobile..."
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Customer Types' },
              { value: 'INDIAN', label: 'Indian (Local)' },
              { value: 'NRI', label: 'NRI (Export)' },
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
            onClick={loadCustomers}
            className="filter-refresh-btn"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Could Not Load Customers"
          message={error}
          onRetry={loadCustomers}
        />
      )}

      {/* DATA TABLE */}
      {!error && (
        <DataTable
          columns={columns}
          data={customers}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No customers found matching the search criteria. Click 'Add Customer' to create a profile."
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={(newPage) => setPage(newPage)}
        />
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add New Customer'}
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
              {editingCustomer ? 'Update Customer' : 'Create Customer'}
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
              label="Customer Full Name"
              id="custName"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              isRequired
              autoFocus
            />

            <Select
              label="Customer Pricing Type"
              id="custType"
              value={formCustomerType}
              onChange={(e) => setFormCustomerType(e.target.value as CustomerType)}
              options={[
                { value: 'INDIAN', label: 'INDIAN (Local Currency & Pricing)' },
                { value: 'NRI', label: 'NRI (Special NRI Export Rate)' },
              ]}
              isRequired
              helperText="Determines applicable price in the Pricing Engine"
            />
          </div>

          <div className="modal-form-row">
            <Input
              label="Mobile Number"
              id="custMobile"
              type="tel"
              value={formMobile}
              onChange={(e) => setFormMobile(e.target.value)}
              placeholder="e.g. 9876543210"
              helperText="10-digit Indian or international mobile"
            />

            <Input
              label="Email Address"
              id="custEmail"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="e.g. ramesh@example.com"
            />
          </div>

          <div className="modal-form-row">
            <Input
              label="City"
              id="custCity"
              type="text"
              value={formCity}
              onChange={(e) => setFormCity(e.target.value)}
              placeholder="e.g. Anand"
            />

            <Input
              label="Country"
              id="custCountry"
              type="text"
              value={formCountry}
              onChange={(e) => setFormCountry(e.target.value)}
              placeholder="e.g. India"
            />
          </div>

          <div className="modal-form-row">
            <Input
              label="GSTIN / Tax ID"
              id="custGstin"
              type="text"
              value={formGstin}
              onChange={(e) => setFormGstin(e.target.value)}
              placeholder="Optional GSTIN for B2B billing"
            />

            <Input
              label="Internal Notes"
              id="custNotes"
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Prefers vacuum packed khakhra"
            />
          </div>

          <Input
            label="Street Address"
            id="custAddress"
            type="text"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            placeholder="e.g. 12, Swaminarayan Society, Station Road"
          />
        </form>
      </Modal>

      {/* CONFIRMATION DIALOG FOR STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, customer: null, nextStatus: false, isSubmitting: false })}
        onConfirm={handleConfirmStatusToggle}
        title={confirmDialog.nextStatus ? 'Activate Customer' : 'Deactivate Customer'}
        message={
          confirmDialog.nextStatus ? (
            `Are you sure you want to activate "${confirmDialog.customer?.name}"?`
          ) : (
            `Are you sure you want to deactivate "${confirmDialog.customer?.name}"?`
          )
        }
        confirmText={confirmDialog.nextStatus ? 'Activate' : 'Deactivate'}
        variant={confirmDialog.nextStatus ? 'primary' : 'danger'}
        isLoading={confirmDialog.isSubmitting}
      />
    </div>
  );
};
