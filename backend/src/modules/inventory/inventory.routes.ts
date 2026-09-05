import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { stockQuerySchema, movementQuerySchema, adjustStockSchema } from './inventory.validation.js';

const router = Router();

router.use(authenticate);

// View stock balances and movements
router.get('/status', validate({ query: stockQuerySchema }), InventoryController.getStockStatus);
router.get('/movements', validate({ query: movementQuerySchema }), InventoryController.getMovements);
router.get('/reconcile/:productId', authorize(['ADMIN']), InventoryController.reconcileStock);

// Manual stock adjustment (Admin only)
router.post('/adjust', authorize(['ADMIN']), validate({ body: adjustStockSchema }), InventoryController.adjustStock);

export default router;
