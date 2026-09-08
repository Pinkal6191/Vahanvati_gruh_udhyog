import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar/Sidebar';
import { Header } from './Header/Header';
import { Drawer } from '../../components/ui/Drawer/Drawer';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import './AppLayout.css';

export const AppLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside className="app-layout-sidebar-container">
          <Sidebar />
        </aside>
      )}

      {/* Mobile / Tablet Drawer */}
      {!isDesktop && (
        <Drawer
          isOpen={isMobileMenuOpen}
          onClose={handleCloseMobileMenu}
          title="Navigation Menu"
          position="left"
          size="sm"
        >
          <div className="app-mobile-sidebar-wrapper">
            <Sidebar onItemClick={handleCloseMobileMenu} />
          </div>
        </Drawer>
      )}

      {/* Main Content Area */}
      <div className="app-layout-container">
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />
        <main className="app-main-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
