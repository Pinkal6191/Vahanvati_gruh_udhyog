import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import {
  salesReportQuerySchema,
  productReportQuerySchema,
  customerReportQuerySchema,
  customerHistoryQuerySchema,
  productionReportQuerySchema,
  stockReportQuerySchema,
  stockMovementsReportQuerySchema,
  returnsReportQuerySchema,
  businessSummaryQuerySchema,
} from './reports.validation.js';

const router = Router();

// Authentication required for all reporting endpoints
router.use(authenticate);

// ============================================================
// 1. SALES REPORTS (ADMIN, OUTLET)
// ============================================================
router.get(
  '/sales',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: salesReportQuerySchema }),
  ReportsController.getSalesReport
);

router.get(
  '/sales/products',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: productReportQuerySchema }),
  ReportsController.getProductSalesReport
);

router.get(
  '/sales/customers',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: customerReportQuerySchema }),
  ReportsController.getCustomerSalesReport
);

router.get(
  '/customers/:customerId',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: customerHistoryQuerySchema }),
  ReportsController.getCustomerPurchaseHistory
);

// ============================================================
// 2. PRODUCTION REPORTS (ADMIN, PRODUCTION)
// ============================================================
router.get(
  '/production',
  authorize(['ADMIN', 'PRODUCTION']),
  validate({ query: productionReportQuerySchema }),
  ReportsController.getProductionReport
);

// ============================================================
// 3. STOCK & INVENTORY REPORTS
// ============================================================
// Current stock report (ADMIN, OUTLET, PRODUCTION)
router.get(
  '/stock',
  authorize(['ADMIN', 'OUTLET', 'PRODUCTION']),
  validate({ query: stockReportQuerySchema }),
  ReportsController.getStockReport
);

// Stock movements ledger report (ADMIN, PRODUCTION)
router.get(
  '/stock/movements',
  authorize(['ADMIN', 'PRODUCTION']),
  validate({ query: stockMovementsReportQuerySchema }),
  ReportsController.getStockMovementsReport
);

// Stock reconciliation audit report (ADMIN only)
router.get(
  '/stock/reconciliation',
  authorize(['ADMIN']),
  ReportsController.getStockReconciliationReport
);

// ============================================================
// 4. SALES RETURN REPORTS (ADMIN, OUTLET)
// ============================================================
router.get(
  '/returns',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: returnsReportQuerySchema }),
  ReportsController.getReturnsReport
);

// ============================================================
// 5. BUSINESS SUMMARY DASHBOARD (ADMIN only)
// ============================================================
router.get(
  '/business-summary',
  authorize(['ADMIN']),
  validate({ query: businessSummaryQuerySchema }),
  ReportsController.getBusinessSummary
);

export default router;
