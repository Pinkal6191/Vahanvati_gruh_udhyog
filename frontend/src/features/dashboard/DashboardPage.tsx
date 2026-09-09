import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Receipt,
  RotateCcw,
  ChefHat,
  Scale,
  Package,
  AlertTriangle,
  PackageX,
  CreditCard,
  ShoppingCart,
  PlusCircle,
  Users,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Card } from '../../components/ui/Card/Card';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { ErrorState } from '../../components/common/ErrorState/ErrorState';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDateTime, formatGramsToKg } from '../../utils/formatters';
import { DashboardApi, BusinessSummaryData, RecentSaleItem } from './dashboard.api';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<BusinessSummaryData | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSaleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, salesData] = await Promise.all([
        DashboardApi.getBusinessSummary({ period: 'today' }),
        DashboardApi.getRecentSales(5),
      ]);
      setSummary(summaryData);
      setRecentSales(salesData);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to load dashboard data. Please make sure the local backend server is running on http://localhost:4000.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading) {
    return (
      <div className="dashboard-loading-container">
        <LoadingState message="Loading live business analytics from backend..." size="lg" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="dashboard-error-container">
        <ErrorState
          title="Cannot Connect to Backend"
          message={error || 'Unable to retrieve business summary from local backend server.'}
          onRetry={loadDashboardData}
        />
      </div>
    );
  }

  const sales = summary.sales || { totalSales: 0, billCount: 0, averageBillValue: 0 };
  const returns = summary.returns || { totalReturnsAmount: 0, returnsCount: 0 };
  const production = summary.production || { totalProductionWeight: 0, productionEntriesCount: 0 };
  const inventory = summary.inventory || { totalItems: 0, inStockCount: 0, lowStockCount: 0, outOfStockCount: 0 };
  const payments = summary.paymentSummary || {};
  const topProducts = summary.topProducts || [];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Admin Operations Dashboard"
        subtitle={`Welcome back, ${user?.fullName || user?.username}. Real-time operational summary for ${summary.period || 'Today'}.`}
        actions={
          <div className="dashboard-header-actions">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={loadDashboardData}
            >
              Refresh
            </Button>
            <Badge variant="brand" size="md">
              Store #01 • Local Server
            </Badge>
          </div>
        }
      />

      {/* 8 SUMMARY CARDS */}
      <div className="dashboard-kpi-grid">
        {/* 1. Today's Sales */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper sales-bg">
            <TrendingUp size={22} className="sales-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Today's Sales</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{formatCurrency(sales.totalSales)}</span>
            </div>
            <span className="kpi-subtext">Avg Bill: {formatCurrency(sales.averageBillValue)}</span>
          </div>
        </Card>

        {/* 2. Today's Bills */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper invoices-bg">
            <Receipt size={22} className="invoices-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Today's Bills</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{sales.billCount}</span>
              <Badge variant="success" size="sm">Completed</Badge>
            </div>
            <span className="kpi-subtext">Total invoices processed</span>
          </div>
        </Card>

        {/* 3. Today's Returns */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper returns-bg">
            <RotateCcw size={22} className="returns-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Today's Returns</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{formatCurrency(returns.totalReturnsAmount)}</span>
              {returns.returnsCount > 0 && (
                <Badge variant="warning" size="sm">{returns.returnsCount} Bills</Badge>
              )}
            </div>
            <span className="kpi-subtext">{returns.returnsCount} return transactions</span>
          </div>
        </Card>

        {/* 4. Today's Production */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper prod-bg">
            <ChefHat size={22} className="prod-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Today's Production</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{formatGramsToKg(production.totalProductionWeight)}</span>
            </div>
            <span className="kpi-subtext">{production.productionEntriesCount} batch runs completed</span>
          </div>
        </Card>

        {/* 5. Net Sales */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper net-bg">
            <Scale size={22} className="net-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Net Sales</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{formatCurrency(summary.netSales)}</span>
              <Badge variant="brand" size="sm">Sales - Returns</Badge>
            </div>
            <span className="kpi-subtext">Authoritative net turnover</span>
          </div>
        </Card>

        {/* 6. Current Stock */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper stock-bg">
            <Package size={22} className="stock-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Current Stock</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{inventory.totalItems}</span>
              <Badge variant="neutral" size="sm">Products</Badge>
            </div>
            <span className="kpi-subtext">{inventory.inStockCount} active items in stock</span>
          </div>
        </Card>

        {/* 7. Low Stock Items */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper lowstock-bg">
            <AlertTriangle size={22} className="lowstock-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Low Stock Items</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{inventory.lowStockCount}</span>
              {inventory.lowStockCount > 0 ? (
                <Badge variant="warning" size="sm">Action Needed</Badge>
              ) : (
                <Badge variant="success" size="sm">Healthy</Badge>
              )}
            </div>
            <span className="kpi-subtext">Below threshold level</span>
          </div>
        </Card>

        {/* 8. Out of Stock Items */}
        <Card className="kpi-card">
          <div className="kpi-icon-wrapper outstock-bg">
            <PackageX size={22} className="outstock-color" />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Out of Stock Items</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{inventory.outOfStockCount}</span>
              {inventory.outOfStockCount > 0 ? (
                <Badge variant="danger" size="sm">Depleted</Badge>
              ) : (
                <Badge variant="success" size="sm">All Active</Badge>
              )}
            </div>
            <span className="kpi-subtext">Requires immediate production</span>
          </div>
        </Card>
      </div>

      {/* QUICK ACTIONS ROW */}
      <Card title="Quick Management Actions" subtitle="Direct navigation to operational terminals">
        <div className="dashboard-quick-actions-bar">
          <Button
            variant="primary"
            leftIcon={<ShoppingCart size={16} />}
            onClick={() => navigate('/billing')}
          >
            New Bill (POS)
          </Button>
          <Button
            variant="outline"
            leftIcon={<PlusCircle size={16} />}
            onClick={() => navigate('/products')}
          >
            Add Product
          </Button>
          <Button
            variant="outline"
            leftIcon={<Users size={16} />}
            onClick={() => navigate('/customers')}
          >
            Add Customer
          </Button>
          <Button
            variant="outline"
            leftIcon={<ChefHat size={16} />}
            onClick={() => navigate('/production')}
          >
            Add Production
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Package size={16} />}
            onClick={() => navigate('/inventory')}
          >
            View Stock
          </Button>
        </div>
      </Card>

      {/* MIDDLE SECTION: TOP PRODUCTS & PAYMENT BREAKDOWN */}
      <div className="dashboard-analytics-grid">
        {/* Top 5 Products */}
        <Card
          title="Top 5 Products"
          subtitle="Ranked by gross sales turnover"
          className="analytics-card"
        >
          {topProducts.length === 0 ? (
            <EmptyState
              title="No Sales Recorded Yet"
              description="Today's top-selling products will automatically display here once bills are processed."
            />
          ) : (
            <div className="top-products-list">
              {topProducts.map((prod, index) => (
                <div key={prod.productId || index} className="top-product-item">
                  <div className="top-product-rank">#{index + 1}</div>
                  <div className="top-product-info">
                    <span className="top-product-name">{prod.productName}</span>
                    <span className="top-product-qty">{prod.quantity} units sold</span>
                  </div>
                  <div className="top-product-revenue">
                    {formatCurrency(prod.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Payment Summary */}
        <Card
          title="Payment Mode Breakdown"
          subtitle="Reconciliation across payment methods"
          className="analytics-card"
        >
          <div className="payment-summary-grid">
            <div className="payment-method-item">
              <div className="payment-method-header">
                <span className="payment-dot cash-dot" />
                <span className="payment-name">Cash</span>
              </div>
              <span className="payment-amount">{formatCurrency(payments.CASH || 0)}</span>
            </div>

            <div className="payment-method-item">
              <div className="payment-method-header">
                <span className="payment-dot upi-dot" />
                <span className="payment-name">UPI / QR</span>
              </div>
              <span className="payment-amount">{formatCurrency(payments.UPI || 0)}</span>
            </div>

            <div className="payment-method-item">
              <div className="payment-method-header">
                <span className="payment-dot card-dot" />
                <span className="payment-name">Card / POS</span>
              </div>
              <span className="payment-amount">{formatCurrency(payments.CARD || 0)}</span>
            </div>

            <div className="payment-method-item">
              <div className="payment-method-header">
                <span className="payment-dot other-dot" />
                <span className="payment-name">Other / Credit</span>
              </div>
              <span className="payment-amount">{formatCurrency(payments.OTHER || 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* RECENT SALES ACTIVITY */}
      <Card
        title="Recent Bills Activity"
        subtitle="Latest completed customer sales from local backend"
        action={
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ExternalLink size={14} />}
            onClick={() => navigate('/billing/history')}
          >
            View All Invoices
          </Button>
        }
      >
        {recentSales.length === 0 ? (
          <EmptyState
            title="No Recent Bills"
            description="Completed sales transactions from today will be listed here in real-time."
          />
        ) : (
          <div className="recent-sales-table-wrapper">
            <table className="recent-sales-table">
              <thead>
                <tr>
                  <th>Bill Number</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <span className="recent-bill-number">{sale.billNumber}</span>
                    </td>
                    <td>
                      <span className="recent-customer-name">
                        {sale.customerNameSnapshot || 'Direct Walk-in'}
                      </span>
                    </td>
                    <td>{sale.totalItemsCount} items</td>
                    <td>
                      <strong>{formatCurrency(sale.finalTotalAmount)}</strong>
                    </td>
                    <td>
                      <Badge variant="success" size="sm">
                        {sale.saleStatus}
                      </Badge>
                    </td>
                    <td className="recent-time">{formatDateTime(sale.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
