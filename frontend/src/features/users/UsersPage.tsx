import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, CheckCircle, XCircle, UserCheck, RefreshCw, Key, Shield } from 'lucide-react';
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
import { formatDate, formatDateTime } from '../../utils/formatters';
import { UsersApi, UserAccount, CreateUserInput, UpdateUserInput } from './users.api';
import { Role } from '../../types/auth.types';
import '../products/master-data.css';

export const UsersPage: React.FC = () => {
  const { addToast } = useToast();

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formUsername, setFormUsername] = useState<string>('');
  const [formFullName, setFormFullName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formRole, setFormRole] = useState<Role>('OUTLET');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Status Toggle Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    user: UserAccount | null;
    nextStatus: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    user: null,
    nextStatus: false,
    isSubmitting: false,
  });

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await UsersApi.list();
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user accounts from local server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users locally based on search, role, status
  const filteredUsers = users.filter((u) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = u.fullName?.toLowerCase().includes(q);
      const matchUser = u.username?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchEmail) return false;
    }
    if (roleFilter && u.role !== roleFilter) {
      return false;
    }
    if (statusFilter === 'active' && !u.isActive) return false;
    if (statusFilter === 'inactive' && u.isActive) return false;
    return true;
  });

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormFullName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('OUTLET');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormFullName(user.fullName);
    setFormEmail(user.email || '');
    setFormPassword('');
    setFormRole(user.role);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formFullName.trim()) {
      setFormError('Full name is required.');
      return;
    }

    if (!editingUser) {
      if (!formUsername.trim()) {
        setFormError('Username is required.');
        return;
      }
      if (!formPassword || formPassword.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }
    } else {
      if (formPassword && formPassword.length < 6) {
        setFormError('New password must be at least 6 characters.');
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        const updatePayload: UpdateUserInput = {
          fullName: formFullName.trim(),
          email: formEmail.trim() || undefined,
          role: formRole,
          password: formPassword ? formPassword : undefined,
        };
        await UsersApi.update(editingUser.id, updatePayload);
        addToast({
          title: 'User Updated',
          message: `User account "${editingUser.username}" updated successfully.`,
          variant: 'success',
        });
      } else {
        const createPayload: CreateUserInput = {
          username: formUsername.trim(),
          password: formPassword,
          fullName: formFullName.trim(),
          email: formEmail.trim() || undefined,
          role: formRole,
        };
        await UsersApi.create(createPayload);
        addToast({
          title: 'User Created',
          message: `User account "${formUsername}" created with role ${formRole}.`,
          variant: 'success',
        });
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save user account.');
    } finally {
      setIsSaving(false);
    }
  };

  // Status Toggle
  const handlePromptStatusToggle = (user: UserAccount) => {
    setConfirmDialog({
      isOpen: true,
      user,
      nextStatus: !user.isActive,
      isSubmitting: false,
    });
  };

  const handleConfirmStatusToggle = async () => {
    if (!confirmDialog.user) return;
    setConfirmDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await UsersApi.updateStatus(confirmDialog.user.id, confirmDialog.nextStatus);
      addToast({
        title: 'Status Updated',
        message: `User "${confirmDialog.user.username}" is now ${
          confirmDialog.nextStatus ? 'active' : 'deactivated'
        }.`,
        variant: 'success',
      });
      setConfirmDialog({ isOpen: false, user: null, nextStatus: false, isSubmitting: false });
      loadUsers();
    } catch (err: any) {
      addToast({
        title: 'Status Change Failed',
        message: err?.message || 'Failed to toggle user status.',
        variant: 'error',
      });
      setConfirmDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'brand';
      case 'PRODUCTION':
        return 'warning';
      case 'OUTLET':
      default:
        return 'success';
    }
  };

  const columns: ColumnDef<UserAccount>[] = [
    {
      key: 'fullName',
      header: 'Full Name',
      cell: (row) => (
        <div className="table-primary-info">
          <span className="info-title">{row.fullName}</span>
          <span className="info-subtitle">Username: @{row.username}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role & Permissions',
      width: '180px',
      cell: (row) => (
        <Badge variant={getRoleBadgeVariant(row.role)} size="sm">
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'email',
      header: 'Email Address',
      width: '200px',
      cell: (row) => <span className="date-text">{row.email || '—'}</span>,
    },
    {
      key: 'lastLoginAt',
      header: 'Last Sign In',
      width: '160px',
      cell: (row) => (
        <span className="date-text">
          {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never logged in'}
        </span>
      ),
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
      width: '130px',
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
            title="Edit user account"
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
            title={row.isActive ? 'Deactivate user' : 'Activate user'}
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
          { label: 'User Administration' },
        ]}
      />

      <PageHeader
        title="User & Staff Administration"
        subtitle="Manage authenticated operator logins, roles (ADMIN, OUTLET, PRODUCTION), and system access."
        actions={
          <div className="header-actions-group">
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenAdd}
            >
              Add User
            </Button>
          </div>
        }
      />

      {/* FILTERS BAR */}
      <div className="master-filters-card">
        <div className="master-filters-grid">
          <SearchInput
            placeholder="Search by name, username, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="filter-search-input"
          />

          <Select
            label=""
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'ADMIN', label: 'Admin Only' },
              { value: 'OUTLET', label: 'Outlet Only' },
              { value: 'PRODUCTION', label: 'Production Only' },
            ]}
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
            onClick={loadUsers}
            className="filter-refresh-btn"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Could Not Load Users"
          message={error}
          onRetry={loadUsers}
        />
      )}

      {/* DATA TABLE */}
      {!error && (
        <DataTable
          columns={columns}
          data={filteredUsers}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No staff accounts found. Click 'Add User' to create an operator account."
        />
      )}

      {/* ADD / EDIT USER MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingUser ? `Edit User: @${editingUser.username}` : 'Create Staff User Account'}
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
              {editingUser ? 'Save Changes' : 'Create User'}
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
            label="Full Name"
            id="userFullName"
            type="text"
            value={formFullName}
            onChange={(e) => setFormFullName(e.target.value)}
            placeholder="e.g. Ramesh Patel"
            isRequired
            autoFocus
          />

          <Input
            label="Username"
            id="userUsername"
            type="text"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            placeholder="e.g. ramesh_patel"
            isRequired
            disabled={!!editingUser}
            helperText={editingUser ? 'Username cannot be modified' : 'Login username used at sign-in'}
          />

          <Input
            label="Email Address"
            id="userEmail"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="e.g. ramesh@vahanvati.com"
            helperText="Optional email for communication"
          />

          <Select
            label="System Role & Terminal Access"
            id="userRole"
            value={formRole}
            onChange={(e) => setFormRole(e.target.value as Role)}
            options={[
              { value: 'OUTLET', label: 'OUTLET — POS Billing & Customer Returns' },
              { value: 'PRODUCTION', label: 'PRODUCTION — Kitchen Batches & Inventory' },
              { value: 'ADMIN', label: 'ADMIN — Full System Access & Master Data' },
            ]}
            isRequired
            helperText="Enforces role-based permissions throughout the system"
          />

          <Input
            label={editingUser ? 'Reset Password (Leave blank to keep current)' : 'Password'}
            id="userPassword"
            type="password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            placeholder={editingUser ? 'Enter new password or leave blank' : 'Minimum 6 characters'}
            isRequired={!editingUser}
            leftIcon={<Key size={16} />}
            helperText={editingUser ? 'Leave blank to preserve current password' : 'Hashed securely with bcrypt'}
          />
        </form>
      </Modal>

      {/* CONFIRMATION DIALOG FOR STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, user: null, nextStatus: false, isSubmitting: false })}
        onConfirm={handleConfirmStatusToggle}
        title={confirmDialog.nextStatus ? 'Activate User Account' : 'Deactivate User Account'}
        message={
          confirmDialog.nextStatus ? (
            `Are you sure you want to activate @${confirmDialog.user?.username}? They will be able to log in.`
          ) : (
            `Are you sure you want to deactivate @${confirmDialog.user?.username}? Their active session will be invalidated and sign-in blocked.`
          )
        }
        confirmText={confirmDialog.nextStatus ? 'Activate' : 'Deactivate'}
        variant={confirmDialog.nextStatus ? 'primary' : 'danger'}
        isLoading={confirmDialog.isSubmitting}
      />
    </div>
  );
};
