import { Router } from 'express';
import { CustomersController } from './customers.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  customerQuerySchema,
} from './customers.validation.js';

const router = Router();

router.use(authenticate);

// Outlet & Admin can list, search, view, create, and edit customer details
router.get('/', validate({ query: customerQuerySchema }), CustomersController.list);
router.get('/:id', CustomersController.getById);
router.post(
  '/',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: createCustomerSchema }),
  CustomersController.create
);
router.patch(
  '/:id',
  authorize(['ADMIN', 'OUTLET']),
  validate({ body: updateCustomerSchema }),
  CustomersController.update
);

// Only ADMIN can activate/deactivate a customer
router.patch(
  '/:id/status',
  authorize(['ADMIN']),
  validate({ body: updateCustomerStatusSchema }),
  CustomersController.updateStatus
);

router.get('/:id/purchases', CustomersController.getPurchaseHistory);

export default router;
