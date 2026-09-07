import { Router } from 'express';
import { SalesController } from './sales.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { createSaleSchema, cancelSaleSchema, salesQuerySchema } from './sales.validation.js';

const router = Router();

// Authentication required for all billing endpoints
router.use(authenticate);

// ============================================================
// OUTLET & ADMIN ACCESS: POS Checkout, Listing, and Bill Details
// ============================================================

// Complete a sale / checkout
router.post(
  '/',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: createSaleSchema }),
  SalesController.createSale
);

// List / search sales history
router.get(
  '/',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: salesQuerySchema }),
  SalesController.listSales
);

// Fetch sale by unique sequential bill number
router.get(
  '/bill/:billNumber',
  authorize(['ADMIN', 'OUTLET']),
  SalesController.getSaleByBillNumber
);

// Get 3-inch thermal print receipt payload
router.get(
  '/:id/print',
  authorize(['ADMIN', 'OUTLET']),
  SalesController.getPrintPayload
);

// Cancel sale and reverse stock (Admin only)
router.post(
  '/:id/cancel',
  authorize(['ADMIN']),
  validate({ body: cancelSaleSchema }),
  SalesController.cancelSale
);

// Fetch sale by UUID ID
router.get(
  '/:id',
  authorize(['ADMIN', 'OUTLET']),
  SalesController.getSaleById
);

export default router;
