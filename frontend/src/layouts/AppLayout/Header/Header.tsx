import React from 'react';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Button } from '../../../components/ui/Button/Button';
import './Header.css';

export interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { user, logout } = useAuth();

  const getRoleBadgeVariant = () => {
    switch (user?.role) {
      case 'ADMIN':
        return 'brand';
      case 'PRODUCTION':
        return 'warning';
      case 'OUTLET':
      default:
        return 'success';
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        {onToggleMobileMenu && (
          <button
            className="mobile-menu-toggle-btn"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="header-store-badge">
          <span className="store-status-dot" />
          <span>Vahanvati Gruh Udhyog (Store #01)</span>
        </div>
      </div>

      <div className="header-right">
        {user && (
          <div className="header-user-profile">
            <div className="user-avatar" aria-hidden="true">
              <UserIcon size={16} />
            </div>
            <div className="user-details">
              <span className="user-name">{user.fullName || user.username}</span>
              <div className="user-role-badge">
                <Badge variant={getRoleBadgeVariant()} size="sm">
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          leftIcon={<LogOut size={16} />}
          title="Sign out of system"
        >
          <span className="logout-text">Logout</span>
        </Button>
      </div>
    </header>
  );
};
