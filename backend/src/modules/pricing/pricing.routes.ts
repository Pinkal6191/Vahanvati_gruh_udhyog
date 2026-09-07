import { Router } from 'express';
import { PricingController } from './pricing.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import {
  createPriceSchema,
  updatePriceSchema,
  batchUpsertPriceSchema,
  resolvePriceSchema,
  resolvePricesSchema,
  priceQuerySchema,
} from './pricing.validation.js';

const router = Router();

// Authentication required for all pricing endpoints
router.use(authenticate);

// ============================================================
// OUTLET & ADMIN ACCESS: Price Resolution & Current Price
// ============================================================

// Resolve applicable price for a single product/pack/weight
router.post(
  '/resolve',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: resolvePriceSchema }),
  PricingController.resolvePrice
);

// Resolve full cart with multiple items
router.post(
  '/resolve-cart',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: resolvePricesSchema }),
  PricingController.resolveCart
);

// Get current applicable prices (filterable by productId, customerType, packConfigId, date)
router.get(
  '/current',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: priceQuerySchema }),
  PricingController.getCurrentPrices
);

// ============================================================
// ADMIN ONLY ACCESS: Price Management, History & Mutations
// ============================================================

// View chronological price history for a product
router.get(
  '/history/:productId',
  authorize(['ADMIN']),
  PricingController.getPriceHistory
);

// Create a new price entry
router.post(
  '/',
  authorize(['ADMIN']),
  validate({ body: createPriceSchema }),
  PricingController.createPrice
);

// Batch update/create prices (atomic transaction)
router.post(
  '/batch',
  authorize(['ADMIN']),
  validate({ body: batchUpsertPriceSchema }),
  PricingController.batchUpdate
);

// Update an existing price entry
router.put(
  '/:id',
  authorize(['ADMIN']),
  validate({ body: updatePriceSchema }),
  PricingController.updatePrice
);

// Toggle active status (activate/deactivate)
router.patch(
  '/:id/status',
  authorize(['ADMIN']),
  PricingController.toggleStatus
);

// Backwards-compatible route: GET /api/v1/pricing/:productId
router.get(
  '/:productId',
  authorize(['ADMIN', 'OUTLET']),
  (req, res, next) => {
    req.query.productId = req.params.productId;
    return PricingController.getCurrentPrices(req, res, next);
  }
);

export default router;
