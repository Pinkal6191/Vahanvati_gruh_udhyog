import { Router } from 'express';
import { ProductionController } from './production.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import {
  createProductionSchema,
  updateProductionSchema,
  cancelProductionSchema,
  productionQuerySchema,
} from './production.validation.js';

const router = Router();

router.use(authenticate);

// Production summary metrics dashboard (registered before /:id to avoid collision)
router.get(
  '/summary',
  authorize(['ADMIN', 'PRODUCTION', 'OUTLET']),
  ProductionController.getSummary
);

// List production entries with rich filtering & pagination
router.get(
  '/',
  authorize(['ADMIN', 'PRODUCTION', 'OUTLET']),
  validate({ query: productionQuerySchema }),
  ProductionController.listEntries
);

// Get single production entry by ID
router.get(
  '/:id',
  authorize(['ADMIN', 'PRODUCTION', 'OUTLET']),
  ProductionController.getById
);

// Create production entry (DRAFT or COMPLETED)
router.post(
  '/',
  authorize(['ADMIN', 'PRODUCTION']),
  validate({ body: createProductionSchema }),
  ProductionController.createEntry
);

// Update draft production entry
router.put(
  '/:id',
  authorize(['ADMIN', 'PRODUCTION']),
  validate({ body: updateProductionSchema }),
  ProductionController.updateEntry
);

// Complete production draft entry (increments stock via StockService)
router.post(
  '/:id/complete',
  authorize(['ADMIN', 'PRODUCTION']),
  ProductionController.completeProduction
);

// Cancel production entry (reverses stock via StockService if completed)
router.post(
  '/:id/cancel',
  authorize(['ADMIN', 'PRODUCTION']),
  validate({ body: cancelProductionSchema }),
  ProductionController.cancelProduction
);

export default router;
