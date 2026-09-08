# Vahanvati Gruh Udhyog — Frontend Architecture & Design System

## 1. Overview & Technology Stack
- **Framework:** React 19 + TypeScript + Vite 6
- **Routing:** React Router DOM v7
- **Styling:** Pure CSS Tokens & Modular BEM-style Component CSS (Zero runtime CSS overhead)
- **Icons:** Lucide React
- **Typography:** Inter (Latin) & Noto Sans Gujarati (Bilingual support)
- **API Base:** `http://localhost:4000/api/v1` (configurable via `.env`)

---

## 2. Design System & Brand Palette
Tokens are located in `src/styles/tokens/`:
- **Primary Brand Color:** Vahanvati Blue (`#3F438F`)
- **Primary Dark:** `#292D68`
- **Secondary Accent:** `#8A3038`
- **Backgrounds:** `#F8F9FB` (Body background), `#FFFFFF` (Surface / Card background)
- **Status Colors:**
  - Success: `#16A34A` (Green)
  - Warning: `#D97706` (Amber)
  - Danger / Error: `#DC2626` (Red)
  - Info: `#2563EB` (Blue)
- **Typography:**
  - Gujarati font stack: `'Noto Sans Gujarati', 'Inter', sans-serif`
  - English font stack: `'Inter', sans-serif`

---

## 3. Directory Structure
```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── app/
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx
│   │   │   └── ToastProvider.tsx
│   │   └── router/
│   │       ├── AppRoutes.tsx
│   │       └── ProtectedRoute.tsx
│   ├── components/
│   │   ├── ui/ (Button, Badge, Card, Modal, Drawer, Tabs)
│   │   ├── forms/ (Input, Select, SearchInput, Checkbox, Switch)
│   │   ├── tables/ (DataTable, Pagination)
│   │   ├── common/ (PageHeader, Breadcrumb, EmptyState, LoadingState, ErrorState)
│   │   └── feedback/ (Alert, Toast, ConfirmationDialog)
│   ├── constants/ (roles.ts, storage.ts, navigation.ts)
│   ├── features/
│   │   ├── auth/ (LoginPage)
│   │   ├── dashboard/ (DashboardPage)
│   │   ├── billing/ (BillingPage, BillHistoryPage)
│   │   ├── sales-returns/ (SalesReturnsPage, SalesReturnsHistoryPage)
│   │   ├── customers/ (CustomersPage)
│   │   ├── inventory/ (StockPage, StockMovementsPage)
│   │   ├── production/ (ProductionPage, ProductionHistoryPage)
│   │   ├── products/ (ProductsPage, CategoriesPage, SubcategoriesPage)
│   │   ├── reports/ (ReportsPage)
│   │   ├── users/ (UsersPage)
│   │   ├── website/ (WebsitePage)
│   │   ├── settings/ (SettingsPage)
│   │   └── common/ (UnauthorizedPage, NotFoundPage)
│   ├── hooks/ (useAuth, useToast, useMediaQuery, usePrint)
│   ├── layouts/
│   │   ├── AppLayout/ (AppLayout, Header, Sidebar)
│   │   └── AuthLayout/ (AuthLayout)
│   ├── services/
│   │   ├── api/ (api-client.ts)
│   │   ├── auth/ (auth.service.ts)
│   │   └── storage/ (storage.service.ts)
│   ├── styles/
│   │   ├── tokens/ (colors, typography, spacing, shadows)
│   │   └── globals/ (reset, utilities, print, index)
│   ├── types/ (auth, api, navigation, common)
│   └── utils/ (cn, formatters, rbac)
└── tests/
    └── frontend-architecture.test.ts
```

---

## 4. Role-Based Access Control (RBAC) Matrix
| Route | Feature Area | Allowed Roles |
|---|---|---|
| `/login` | Authentication | Public (Redirects to `/dashboard` if logged in) |
| `/dashboard` | Operations Overview | `ADMIN`, `OUTLET`, `PRODUCTION` |
| `/billing` | POS Billing Terminal | `ADMIN`, `OUTLET` |
| `/billing/history` | Sales Invoices Archive | `ADMIN`, `OUTLET` |
| `/sales-returns` | Sales Returns Terminal | `ADMIN`, `OUTLET` |
| `/sales-returns/history` | Return Audit History | `ADMIN`, `OUTLET` |
| `/customers` | Customer Directory | `ADMIN`, `OUTLET` |
| `/inventory` | Current Stock Balances | `ADMIN`, `OUTLET`, `PRODUCTION` |
| `/inventory/movements` | Stock Movements Ledger | `ADMIN`, `OUTLET`, `PRODUCTION` |
| `/production` | Production Batch Entry | `ADMIN`, `PRODUCTION` |
| `/production/history`| Production Run Records | `ADMIN`, `PRODUCTION` |
| `/products` | Products Catalog | `ADMIN` |
| `/categories` | Category Masters | `ADMIN` |
| `/subcategories` | Subcategory Masters | `ADMIN` |
| `/reports` | Business Analytics | `ADMIN` |
| `/users` | User & Staff Admin | `ADMIN` |
| `/website` | Public Website CMS | `ADMIN` |
| `/settings` | Store & POS Settings | `ADMIN` |

---

## 5. Security & Authoritative State Rules
1. **Zero Price Calculation on Frontend:** All product prices, customer type discounts (Indian vs. NRI), subtotals, tax rates, and totals are computed strictly by backend Step 4 & Step 5 engines.
2. **Zero Direct Stock Calculations:** Front-end never increments or decrements inventory balances; all stock allocations occur through backend Step 5/6/7/8 services.
3. **Session Interceptor:** In `api-client.ts`, any `401 Unauthorized` response immediately triggers `storageService.clearAuthSession()` and notifies `AuthProvider` to redirect to `/login`.
4. **Thermal Receipt Printing:** Dedicated print stylesheets (`@media print`) and `usePrint()` hook format receipts for standard 80mm thermal receipt printers without margins, page headers, or footers.
