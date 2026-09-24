import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Keyboard, Store, User, Lock, Tag } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Customer } from '../../customers/customers.api';
import { CustomerType } from '../../../types/common.types';
import { SaleType } from '../../../types/auth.types';

export interface BillingHeaderProps {
  itemCount: number;
  customer: Customer | null;
  customerType: CustomerType;
  saleType: SaleType;
  onSaleTypeChange: (type: SaleType) => void;
  onOpenShortcuts: () => void;
  onOpenCustomerModal: () => void;
}

export const BillingHeader: React.FC<BillingHeaderProps> = ({
  customer,
  customerType,
  saleType,
  onSaleTypeChange,
  onOpenShortcuts,
  onOpenCustomerModal,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Authoritative permissions check for UX options (Backend enforces hard 403 boundary)
  const isMaster = !!(user?.isMasterAdmin || user?.role === 'ADMIN');
  const allowedSaleTypes: SaleType[] = isMaster
    ? ['RETAIL', 'NRI', 'WHOLESALE']
    : (user?.allowedBillingSaleTypes && user.allowedBillingSaleTypes.length > 0)
    ? user.allowedBillingSaleTypes
    : ['RETAIL', 'NRI'];

  const saleTypeOptions: Array<{ type: SaleType; label: string; description: string }> = [
    { type: 'RETAIL', label: 'Retail', description: 'Standard Domestic Retail Pricing' },
    { type: 'NRI', label: 'NRI', description: 'Export & NRI Diaspora Pricing' },
    { type: 'WHOLESALE', label: 'Wholesale', description: 'Bulk & Institutional B2B Pricing' },
  ];

  return (
    <header className="pos-top-header">
      <div className="pos-header-left">
        <div className="pos-brand-badge">
          <Store size={18} className="pos-brand-icon" />
          <div className="pos-brand-text">
            <h1 className="pos-page-title">Point of Sale (POS)</h1>
            <span className="pos-page-sub">Fast Billing Terminal • Store #01</span>
          </div>
        </div>

        <div className="pos-active-operator-pill">
          <span className="pos-operator-dot"></span>
          <span className="pos-operator-name">{user?.fullName || user?.username}</span>
          <Badge variant="neutral" size="sm">
            {user?.role}
          </Badge>
        </div>
      </div>

      {/* CENTER: SALE TYPE TRANSACTION SELECTOR */}
      <div className="pos-header-center">
        <div className="pos-saletype-container">
          <div className="pos-saletype-label-wrap">
            <Tag size={13} className="pos-saletype-icon" />
            <span className="pos-saletype-title">Sale Type:</span>
          </div>
          <div className="pos-saletype-toggle-group" role="radiogroup" aria-label="Transaction Sale Type">
            {saleTypeOptions.map((opt) => {
              const isAllowed = allowedSaleTypes.includes(opt.type);
              const isActive = saleType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  disabled={!isAllowed}
                  onClick={() => isAllowed && onSaleTypeChange(opt.type)}
                  className={`pos-saletype-pill ${opt.type.toLowerCase()} ${isActive ? 'active' : ''} ${!isAllowed ? 'disabled' : ''}`}
                  title={
                    !isAllowed
                      ? `Access Restricted: Not authorized for ${opt.label} billing`
                      : `${opt.label} - ${opt.description}`
                  }
                >
                  {!isAllowed && <Lock size={12} className="pos-saletype-lock" />}
                  <span className="pos-saletype-name">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pos-header-right">
        {/* Customer Demographic Badge Button */}
        <button
          type="button"
          className="pos-header-customer-btn"
          onClick={onOpenCustomerModal}
          title="Change Customer (Demographic attribute only - does not alter transaction pricing tier)"
        >
          <User size={14} />
          <span className="pos-header-customer-name">
            {customer ? customer.name : 'Walk-in'}
          </span>
          <span className="pos-demographic-chip" title={`Demographic: ${customerType}`}>
            {customerType}
          </span>
        </button>

        {/* Shortcuts Button */}
        <button
          type="button"
          className="btn btn-outline btn-sm pos-header-action-btn"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts Guide"
        >
          <Keyboard size={15} />
          <span>Shortcuts</span>
        </button>

        {/* Bill History Link */}
        <button
          type="button"
          className="btn btn-outline btn-sm pos-header-action-btn"
          onClick={() => navigate('/billing/history')}
          title="Past Invoices History"
        >
          <History size={15} />
          <span>History</span>
        </button>
      </div>
    </header>
  );
};
