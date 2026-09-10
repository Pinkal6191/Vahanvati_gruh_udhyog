import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  RotateCcw,
  ChefHat,
  Boxes,
  ArrowLeftRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { hasRole } from '../../../utils/rbac';
import { Role } from '../../../types/auth.types';
import { cn } from '../../../utils/cn';
import './ReportNav.css';

interface ReportNavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  allowedRoles: Role[];
}

const REPORT_NAV_ITEMS: ReportNavItem[] = [
  {
    label: 'Overview',
    path: '/reports',
    icon: <BarChart3 size={16} />,
    allowedRoles: ['ADMIN'],
  },
  {
    label: 'Sales',
    path: '/reports/sales',
    icon: <TrendingUp size={16} />,
    allowedRoles: ['ADMIN', 'OUTLET'],
  },
  {
    label: 'Products',
    path: '/reports/products',
    icon: <Package size={16} />,
    allowedRoles: ['ADMIN', 'OUTLET'],
  },
  {
    label: 'Customers',
    path: '/reports/customers',
    icon: <Users size={16} />,
    allowedRoles: ['ADMIN', 'OUTLET'],
  },
  {
    label: 'Returns',
    path: '/reports/returns',
    icon: <RotateCcw size={16} />,
    allowedRoles: ['ADMIN', 'OUTLET'],
  },
  {
    label: 'Production',
    path: '/reports/production',
    icon: <ChefHat size={16} />,
    allowedRoles: ['ADMIN', 'PRODUCTION'],
  },
  {
    label: 'Stock',
    path: '/reports/stock',
    icon: <Boxes size={16} />,
    allowedRoles: ['ADMIN', 'OUTLET', 'PRODUCTION'],
  },
  {
    label: 'Movements',
    path: '/reports/stock-movements',
    icon: <ArrowLeftRight size={16} />,
    allowedRoles: ['ADMIN', 'PRODUCTION'],
  },
  {
    label: 'Reconciliation',
    path: '/reports/reconciliation',
    icon: <ShieldCheck size={16} />,
    allowedRoles: ['ADMIN'],
  },
];

export const ReportNav: React.FC = () => {
  const { user } = useAuth();

  const authorizedItems = REPORT_NAV_ITEMS.filter((item) =>
    hasRole(user, item.allowedRoles)
  );

  return (
    <nav className="report-nav-container" aria-label="Reports Navigation">
      <div className="report-nav-scroll">
        {authorizedItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/reports'}
            className={({ isActive }) =>
              cn('report-nav-tab', isActive && 'report-nav-tab-active')
            }
          >
            <span className="report-nav-icon">{item.icon}</span>
            <span className="report-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
