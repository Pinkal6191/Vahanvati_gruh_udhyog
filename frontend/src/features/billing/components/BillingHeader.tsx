import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Keyboard, Store, User, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Customer } from '../../customers/customers.api';
import { CustomerType } from '../../../types/common.types';

export interface BillingHeaderProps {
  itemCount: number;
  customer: Customer | null;
  customerType: CustomerType;
  onOpenShortcuts: () => void;
  onOpenCustomerModal: () => void;
}

export const BillingHeader: React.FC<BillingHeaderProps> = ({
  itemCount,
  customer,
  customerType,
  onOpenShortcuts,
  onOpenCustomerModal,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

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

      <div className="pos-header-right">
        {/* Customer Badge Button */}
        <button
          type="button"
          className="pos-header-customer-btn"
          onClick={onOpenCustomerModal}
          title="Change Customer / Customer Type"
        >
          <User size={14} />
          <span className="pos-header-customer-name">
            {customer ? customer.name : 'Walk-in'}
          </span>
          <Badge
            variant={customerType === 'NRI' ? 'warning' : 'brand'}
            size="sm"
          >
            {customerType}
          </Badge>
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
