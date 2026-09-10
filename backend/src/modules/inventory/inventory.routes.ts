import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { stockQuerySchema, movementQuerySchema, adjustStockSchema } from './inventory.validation.js';

const router = Router();

// All inventory endpoints require authentication
router.use(authenticate);

// View overall stock balances (ADMIN, OUTLET, PRODUCTION)
router.get('/status', authorize(['ADMIN', 'OUTLET', 'PRODUCTION']), validate({ query: stockQuerySchema }), InventoryController.getStockStatus);
router.get('/stocks', authorize(['ADMIN', 'OUTLET', 'PRODUCTION']), validate({ query: stockQuerySchema }), InventoryController.getStockStatus);

// View high-level inventory summary dashboard (ADMIN, OUTLET, PRODUCTION)
router.get('/summary', authorize(['ADMIN', 'OUTLET', 'PRODUCTION']), InventoryController.getStockSummary);

// View single product stock status (ADMIN, OUTLET, PRODUCTION)
router.get('/product/:productId', authorize(['ADMIN', 'OUTLET', 'PRODUCTION']), InventoryController.getProductStock);
router.get('/stocks/:productId', authorize(['ADMIN', 'OUTLET', 'PRODUCTION']), InventoryController.getProductStock);

// View stock movement history (ADMIN, OUTLET, PRODUCTION)
router.get('/movements', authorize(['ADMIN', 'OUTLET', 'PRODUCTION']), validate({ query: movementQuerySchema }), InventoryController.getMovements);

// Manual stock adjustment (ADMIN only)
router.post('/adjust', authorize(['ADMIN']), validate({ body: adjustStockSchema }), InventoryController.adjustStock);

// Reconcile stock balance against ledger (ADMIN only)
router.get('/reconcile/:productId', authorize(['ADMIN']), InventoryController.reconcileStock);

export default router;
