import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Users,
  Package,
  ArrowLeftRight,
  ChefHat,
  Tags,
  FolderTree,
  ListTree,
  BarChart3,
  UserCog,
  Globe,
  Settings,
} from 'lucide-react';
import { NAVIGATION_GROUPS } from '../../../constants/navigation';
import { filterNavigationByRole } from '../../../utils/rbac';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../utils/cn';
import './Sidebar.css';

// Icon mapping helper
const getNavIcon = (path: string) => {
  switch (path) {
    case '/dashboard':
      return <LayoutDashboard size={18} />;
    case '/billing':
      return <ShoppingCart size={18} />;
    case '/billing/history':
      return <Receipt size={18} />;
    case '/sales-returns':
      return <RotateCcw size={18} />;
    case '/customers':
      return <Users size={18} />;
    case '/inventory':
      return <Package size={18} />;
    case '/inventory/movements':
      return <ArrowLeftRight size={18} />;
    case '/production':
      return <ChefHat size={18} />;
    case '/products':
      return <Tags size={18} />;
    case '/categories':
      return <FolderTree size={18} />;
    case '/subcategories':
      return <ListTree size={18} />;
    case '/reports':
      return <BarChart3 size={18} />;
    case '/users':
      return <UserCog size={18} />;
    case '/website':
      return <Globe size={18} />;
    case '/settings':
      return <Settings size={18} />;
    default:
      return <Package size={18} />;
  }
};

export interface SidebarProps {
  onItemClick?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onItemClick, className }) => {
  const { user } = useAuth();
  const visibleGroups = filterNavigationByRole(NAVIGATION_GROUPS, user);

  return (
    <aside className={cn('app-sidebar', className)}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <img src="/logo.png" alt="Vahanvati" className="sidebar-brand-img" />
        </div>
        <div className="sidebar-brand-info">
          <span className="sidebar-brand-title">Vahanvati</span>
          <span className="sidebar-brand-sub">Gruh Udhyog</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main Navigation">
        {visibleGroups.map((group, gIdx) => (
          <div key={gIdx} className="sidebar-group">
            <span className="sidebar-group-title">{group.groupTitle}</span>
            <div className="sidebar-group-items">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn('sidebar-nav-link', isActive && 'sidebar-nav-link-active')
                  }
                >
                  <span className="sidebar-nav-icon">{getNavIcon(item.path)}</span>
                  <span className="sidebar-nav-text">{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-version">v1.0.0 (Step 10 Shell)</div>
      </div>
    </aside>
  );
};
