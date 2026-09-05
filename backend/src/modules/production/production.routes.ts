import { Router } from 'express';
import { ProductionController } from './production.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { createProductionSchema, productionQuerySchema } from './production.validation.js';

const router = Router();

router.use(authenticate);

// Production entry is accessible to PRODUCTION and ADMIN roles
router.post(
  '/',
  authorize(['ADMIN', 'PRODUCTION']),
  validate({ body: createProductionSchema }),
  ProductionController.createEntry
);

router.get('/', validate({ query: productionQuerySchema }), ProductionController.listEntries);
router.get('/:id', ProductionController.getById);

export default router;
