import { Router } from 'express';
import { PricingController } from './pricing.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { upsertPriceSchema, batchUpsertPriceSchema, resolvePricesSchema } from './pricing.validation.js';

const router = Router();

router.use(authenticate);

// Publicly available to authenticated users (e.g. Outlet checking cart prices)
router.post('/resolve-cart', validate({ body: resolvePricesSchema }), PricingController.resolveCart);
router.get('/:productId', PricingController.getProductPrices);

// Admin only: price management
router.post('/', authorize(['ADMIN']), validate({ body: upsertPriceSchema }), PricingController.upsertPrice);
router.post('/batch', authorize(['ADMIN']), validate({ body: batchUpsertPriceSchema }), PricingController.batchUpsert);

export default router;
