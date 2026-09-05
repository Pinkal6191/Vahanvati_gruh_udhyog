import { Router } from 'express';
import { SalesController } from './sales.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { createSaleSchema, salesQuerySchema } from './sales.validation.js';

const router = Router();

router.use(authenticate);

// Outlet & Admin can checkout and view bills
router.post('/', authorize(['ADMIN', 'OUTLET']), validate({ body: createSaleSchema }), SalesController.createSale);
router.get('/', validate({ query: salesQuerySchema }), SalesController.listSales);
router.get('/:id', SalesController.getSaleById);
router.get('/bill/:billNumber', SalesController.getSaleByBillNumber);
router.get('/:id/print', SalesController.getPrintPayload);

export default router;
