# Frontend Step 12 — POS / Billing Terminal & History Documentation

**System:** Vahanvati Gruh Udhyog  
**Module:** Point-of-Sale (POS) Billing Terminal & Bill History UI  
**Routes:** `/billing` (POS Terminal), `/billing/history` (Bill History & Invoices)  
**Status:** Completed & Verified  

---

## 1. Architectural Overview

The POS Terminal is designed for high-speed counter operations, touch screens, and full keyboard-first workflow. It seamlessly bridges client ergonomics with authoritative backend calculation and stock ledger validation.

```
+-----------------------------------------------------------------------------------+
| Top Bar: Operator Badge | Customer Selector (F4) | Bill Number | Shortcuts Modal   |
+----------------------------------------------------+------------------------------+
| Left Pane (55-65%): Product Catalog                | Right Pane (35-45%): Cart    |
| - Fast Search (Ctrl+K) [English / Gujarati / Code] | - Customer Details Card      |
| - Category & Subcategory Filter Badges             | - Interactive Line Items     |
| - Touch-Friendly Product Cards                     | - Steppers & Loose Weights   |
| - Pack Size Selector & Stock Badges                | - Discount & Totals (₹)      |
| - Click/Tap to Add & Merge Duplicates              | - Fast Payment Selection     |
|                                                    | - Tender Presets & Change    |
|                                                    | - [Complete Bill] (Ctrl+Enter)|
+----------------------------------------------------+------------------------------+
```

---

## 2. Implemented Components & Modules

### A. API Layer (`src/features/billing/billing.api.ts`)
- `BillingApi.resolveCart`: Authoritative backend pricing resolution (`POST /api/v1/pricing/resolve-cart`).
- `BillingApi.createSale`: Transaction checkout (`POST /api/v1/sales`).
- `BillingApi.list`: Paginated invoice history with filters (`GET /api/v1/sales`).
- `BillingApi.getById` & `BillingApi.getByBillNumber`: Single invoice detail retrieval.
- `BillingApi.getPrintPayload`: Receipt generation payload (`GET /api/v1/sales/:id/print`).
- `BillingApi.cancelSale`: Admin cancellation and inventory rollback (`POST /api/v1/sales/:id/cancel`).

### B. Cart State & Calculation Hook (`src/features/billing/hooks/useBillingCart.ts`)
- **Duplicate Line Merging**: Adding the same product + pack multiple times merges into a single cart row (`qty + 1`).
- **Dynamic Dual-Pricing Resolution**: Whenever customer type switches (`INDIAN` vs `NRI`), client calls `/pricing/resolve-cart` to refresh authoritative prices without page reload.
- **Stock Warnings**: Real-time comparison with available physical balance.
- **Submission Guard**: Double-click protection with atomic `isSubmitting` flag.

### C. Catalog & Search (`src/features/billing/components/ProductCatalogPane.tsx` & `ProductCard.tsx`)
- Sub-second fuzzy search across English name, Gujarati name (`Noto Sans Gujarati`), product code, and barcode.
- Category pills with dynamic subcategory filter dropdown.
- Pack configuration selector with active pricing display.
- Color-coded stock badges: `In Stock`, `Low Stock (<min)`, `Out of Stock`.

### D. Customer Modal (`src/features/billing/components/CustomerSelectModal.tsx`)
- Search existing customers by mobile or name.
- Quick-add customer form without leaving POS screen.
- Clear walk-in customer button.

### E. Cart Summary & Checkout (`src/features/billing/components/CartSummaryPane.tsx`)
- Item table with stepper controls (`-` / `+`), quantity input, unit price, line total, and remove button.
- Subtotal, flat discount input, and grand total in Indian Rupees (`₹`).
- Fast payment mode buttons: `CASH`, `UPI`, `CARD`, `OTHER`.
- Cash tender presets (`Exact`, `₹100`, `₹200`, `₹500`, `₹2000`) and live change calculation.
- Primary checkout button with loading spinner and disabled states.

### F. Success & Thermal Receipt (`BillSuccessModal.tsx` & `PrintReceiptModal.tsx`)
- Post-sale modal displaying generated bill number (`VGU-YYYYMMDD-XXXX`), payment method, and change returned.
- High-efficiency 80mm / 3-inch thermal receipt format via `@media print`.
- **Confidentiality Guard**: Customer pricing tier (`INDIAN`/`NRI`) is **never printed** on customer-facing receipts.

### G. Bill History & Management (`BillHistoryPage.tsx` & `BillDetailsDrawer.tsx`)
- Comprehensive invoice ledger with bill number search, date range, status, and payment mode filters.
- Detailed invoice drawer showing snapshot rates, customer info, items, and payments.
- One-click reprint receipt action.
- Secure Admin-only Bill Cancellation dialog with mandatory audit reason and stock reversal.

---

## 3. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + K` / `Cmd + K` | Focus product search input |
| `Ctrl + Enter` / `Cmd + Enter` | Complete current bill checkout |
| `F2` | Start a new bill / Reset cart |
| `F4` | Open customer selection modal |
| `Esc` | Close active modals / drawers |
| `?` | Show keyboard shortcuts guide |

---

## 4. Verification & Quality Gates

- **Unit & Integration Tests**: All 45 tests passing (16 Step 10, 13 Step 11, 16 Step 12).
- **TypeScript & Vite Build**: Clean compile with zero type errors.
- **Backend Regression Suite**: 259/259 tests passing, stock reconciliation and historical price immutability intact.
