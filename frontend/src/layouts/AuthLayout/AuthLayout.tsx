import React from 'react';
import { Outlet } from 'react-router-dom';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  return (
    <div className="auth-layout">
      <div className="auth-card-wrapper">
        <div className="auth-header">
          <div className="auth-brand-logo">VG</div>
          <h1 className="auth-brand-title">Vahanvati Gruh Udhyog</h1>
          <p className="auth-brand-subtitle">
            Billing, Production & Business Management System
          </p>
        </div>
        <div className="auth-content">
          <Outlet />
        </div>
        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Vahanvati Gruh Udhyog. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
