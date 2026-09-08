import { Router } from 'express';
import { ReturnsController } from './returns.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import {
  createReturnSchema,
  updateReturnSchema,
  cancelReturnSchema,
  returnsQuerySchema,
} from './returns.validation.js';

const router = Router();

router.use(authenticate);

// Return summary metrics dashboard (registered before :id to prevent collision)
router.get('/summary', authorize(['ADMIN', 'OUTLET']), ReturnsController.getSummary);

// Returnable preview for a bill/sale (registered before :id to prevent collision)
router.get('/preview/:saleId', authorize(['ADMIN', 'OUTLET']), ReturnsController.getReturnPreview);

// List returns with rich filtering and pagination
router.get(
  '/',
  authorize(['ADMIN', 'OUTLET']),
  validate({ query: returnsQuerySchema }),
  ReturnsController.listReturns
);

// Get single return details by ID
router.get('/:id', authorize(['ADMIN', 'OUTLET']), ReturnsController.getById);

// Create new sales return (DRAFT or COMPLETED)
router.post(
  '/',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: createReturnSchema }),
  ReturnsController.createReturn
);

// Update DRAFT return
router.put(
  '/:id',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: updateReturnSchema }),
  ReturnsController.updateReturn
);

// Complete DRAFT return (restocks via StockService)
router.post(
  '/:id/complete',
  authorize(['ADMIN', 'OUTLET']),
  ReturnsController.completeReturn
);

// Cancel return (reverses stock if completed)
router.post(
  '/:id/cancel',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: cancelReturnSchema }),
  ReturnsController.cancelReturn
);

export default router;
