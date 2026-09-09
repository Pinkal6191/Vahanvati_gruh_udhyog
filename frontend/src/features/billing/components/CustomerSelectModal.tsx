import React, { useState, useEffect } from 'react';
import { Search, UserPlus, UserCheck, X, Phone, Globe, MapPin } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/forms/Input/Input';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Customer, CustomersApi, CreateCustomerInput } from '../../customers/customers.api';
import { CustomerType } from '../../../types/common.types';

export interface CustomerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer | null) => void;
  currentCustomer: Customer | null;
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  currentCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'new'>('search');

  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // New customer form state
  const [newName, setNewName] = useState<string>('');
  const [newMobile, setNewMobile] = useState<string>('');
  const [newType, setNewType] = useState<CustomerType>('INDIAN');
  const [newCity, setNewCity] = useState<string>('Ahmedabad');
  const [newError, setNewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Search customers debounced
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await CustomersApi.list({
          search: searchTerm.trim() || undefined,
          limit: 20,
          status: 'active',
        });
        setCustomers(res.items || []);
      } catch (err) {
        console.warn('Customer search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen]);

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    onClose();
  };

  const handleSetWalkIn = () => {
    onSelectCustomer(null);
    onClose();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewError(null);

    if (!newName.trim()) {
      setNewError('Customer name is required.');
      return;
    }

    if (!newMobile.trim() || newMobile.trim().length < 10) {
      setNewError('Valid 10-digit mobile number is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateCustomerInput = {
        name: newName.trim(),
        mobile: newMobile.trim(),
        customerType: newType,
        city: newCity.trim() || undefined,
      };

      const created = await CustomersApi.create(payload);
      onSelectCustomer(created);
      onClose();
    } catch (err: any) {
      setNewError(err.message || 'Failed to create customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select or Add Customer"
      size="lg"
    >
      <div className="pos-customer-modal">
        {/* TAB BUTTONS */}
        <div className="pos-modal-tabs">
          <button
            type="button"
            className={`pos-modal-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={15} />
            <span>Search Existing</span>
          </button>
          <button
            type="button"
            className={`pos-modal-tab ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            <UserPlus size={15} />
            <span>+ Quick Add Customer</span>
          </button>
        </div>

        {activeTab === 'search' ? (
          <div className="pos-customer-search-content">
            <div className="pos-customer-search-input-wrapper">
              <Search size={16} className="pos-search-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search by customer name or mobile number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => setSearchTerm('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* QUICK WALK-IN BUTTON */}
            <div className="pos-walkin-selector">
              <button
                type="button"
                className="btn btn-outline btn-sm pos-walkin-btn"
                onClick={handleSetWalkIn}
              >
                <Globe size={14} />
                <span>Default Counter Walk-in (Standard Indian Pricing)</span>
              </button>
            </div>

            {/* CUSTOMER LIST */}
            <div className="pos-customer-list">
              {isLoading ? (
                <p className="pos-text-muted">Searching customers...</p>
              ) : customers.length === 0 ? (
                <div className="pos-no-customers">
                  <p className="pos-text-muted">No customers found matching &quot;{searchTerm}&quot;.</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setNewName(searchTerm);
                      setActiveTab('new');
                    }}
                  >
                    + Create &quot;{searchTerm}&quot; as new customer
                  </button>
                </div>
              ) : (
                customers.map((c) => {
                  const isSelected = currentCustomer?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`pos-customer-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(c)}
                    >
                      <div className="pos-customer-item-info">
                        <div className="pos-customer-item-name-row">
                          <strong className="pos-customer-name">{c.name}</strong>
                          <Badge
                            variant={c.customerType === 'NRI' ? 'warning' : 'brand'}
                            size="sm"
                          >
                            {c.customerType}
                          </Badge>
                        </div>
                        <div className="pos-customer-item-details">
                          <span className="pos-detail-text">
                            <Phone size={12} /> {c.mobile}
                          </span>
                          {c.city && (
                            <span className="pos-detail-text">
                              <MapPin size={12} /> {c.city}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant={isSelected ? 'primary' : 'outline'}
                        size="sm"
                        leftIcon={<UserCheck size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(c);
                        }}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* QUICK ADD FORM */
          <form onSubmit={handleCreateCustomer} className="pos-new-customer-form">
            {newError && <div className="pos-form-error">{newError}</div>}

            <Input
              label="Full Name"
              id="newCustName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              isRequired
              autoFocus
            />

            <Input
              label="Mobile Number"
              id="newCustMobile"
              type="tel"
              value={newMobile}
              onChange={(e) => setNewMobile(e.target.value)}
              placeholder="e.g. 9825012345"
              isRequired
              helperText="10-digit Indian mobile number"
            />

            <div className="form-group">
              <label className="form-label">Customer Type & Pricing Tier *</label>
              <div className="pos-type-toggle-group">
                <button
                  type="button"
                  className={`pos-type-toggle-btn ${newType === 'INDIAN' ? 'active' : ''}`}
                  onClick={() => setNewType('INDIAN')}
                >
                  <strong>INDIAN</strong>
                  <span>Standard Domestic Rates</span>
                </button>
                <button
                  type="button"
                  className={`pos-type-toggle-btn ${newType === 'NRI' ? 'active' : ''}`}
                  onClick={() => setNewType('NRI')}
                >
                  <strong>NRI</strong>
                  <span>Special Export / NRI Rates</span>
                </button>
              </div>
            </div>

            <Input
              label="City"
              id="newCustCity"
              type="text"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="e.g. Ahmedabad, London, New York"
            />

            <div className="pos-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveTab('search')}
              >
                Back to Search
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
              >
                Save & Select Customer
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
