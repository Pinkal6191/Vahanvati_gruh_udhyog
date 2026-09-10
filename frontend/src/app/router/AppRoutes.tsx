import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout/AuthLayout';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../../features/auth/LoginPage';
import { UnauthorizedPage } from '../../features/common/UnauthorizedPage';
import { NotFoundPage } from '../../features/common/NotFoundPage';

// Feature pages
import { DashboardPage } from '../../features/dashboard/DashboardPage';
import { BillingPage } from '../../features/billing/BillingPage';
import { BillHistoryPage } from '../../features/billing/BillHistoryPage';
import { SalesReturnsPage } from '../../features/sales-returns/SalesReturnsPage';
import { SalesReturnDetailPage } from '../../features/sales-returns/SalesReturnDetailPage';
import { SalesReturnsHistoryPage } from '../../features/sales-returns/SalesReturnsHistoryPage';
import { CustomersPage } from '../../features/customers/CustomersPage';
import { CustomerHistoryPage } from '../../features/customers/CustomerHistoryPage';
import { StockPage } from '../../features/inventory/StockPage';
import { StockMovementsPage } from '../../features/inventory/StockMovementsPage';
import { ProductionPage } from '../../features/production/ProductionPage';
import { ProductionDetailPage } from '../../features/production/ProductionDetailPage';
import { ProductionHistoryPage } from '../../features/production/ProductionHistoryPage';
import { ProductsPage } from '../../features/products/ProductsPage';
import { CategoriesPage } from '../../features/products/CategoriesPage';
import { SubcategoriesPage } from '../../features/products/SubcategoriesPage';
import { ReportsPage } from '../../features/reports/ReportsPage';
import { SalesReportPage } from '../../features/reports/SalesReportPage';
import { ProductSalesReportPage } from '../../features/reports/ProductSalesReportPage';
import { CustomerSalesReportPage } from '../../features/reports/CustomerSalesReportPage';
import { CustomerReportDetailPage } from '../../features/reports/CustomerReportDetailPage';
import { ProductionReportPage } from '../../features/reports/ProductionReportPage';
import { StockReportPage } from '../../features/reports/StockReportPage';
import { StockMovementsReportPage } from '../../features/reports/StockMovementsReportPage';
import { StockReconciliationReportPage } from '../../features/reports/StockReconciliationReportPage';
import { ReturnsReportPage } from '../../features/reports/ReturnsReportPage';
import { UsersPage } from '../../features/users/UsersPage';
import { WebsitePage } from '../../features/website/WebsitePage';
import { SettingsPage } from '../../features/settings/SettingsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Accessible to all authenticated roles */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Billing & Sales - Admin & Outlet */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <BillingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/history"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <BillHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-returns"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <SalesReturnsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-returns/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <SalesReturnDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-returns/history"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <SalesReturnsHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* Customer Directory - Admin & Outlet */}
        <Route
          path="/customers"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/:customerId"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <CustomerHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* Inventory - Admin, Outlet & Production */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET', 'PRODUCTION']}>
              <StockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/movements"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET', 'PRODUCTION']}>
              <StockMovementsPage />
            </ProtectedRoute>
          }
        />

        {/* Production - Admin & Production */}
        <Route
          path="/production"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PRODUCTION']}>
              <ProductionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PRODUCTION']}>
              <ProductionDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production/history"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PRODUCTION']}>
              <ProductionHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* Master Data & Admin Settings - Admin Only */}
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subcategories"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SubcategoriesPage />
            </ProtectedRoute>
          }
        />
        {/* Reports & Analytics - Role Guarded */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/sales"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <SalesReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/products"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <ProductSalesReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/customers"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <CustomerSalesReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/customers/:customerId"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <CustomerReportDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/returns"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET']}>
              <ReturnsReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/production"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PRODUCTION']}>
              <ProductionReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/stock"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OUTLET', 'PRODUCTION']}>
              <StockReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/stock-movements"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PRODUCTION']}>
              <StockMovementsReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/reconciliation"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <StockReconciliationReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/website"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <WebsitePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
