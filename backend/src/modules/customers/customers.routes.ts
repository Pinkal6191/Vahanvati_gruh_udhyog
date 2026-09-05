import { Router } from 'express';
import { CustomersController } from './customers.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { createCustomerSchema, updateCustomerSchema, customerQuerySchema } from './customers.validation.js';

const router = Router();

// Outlet & Admin can access customer endpoints
router.use(authenticate);

router.get('/', validate({ query: customerQuerySchema }), CustomersController.list);
router.post('/', authorize(['ADMIN', 'OUTLET']), validate({ body: createCustomerSchema }), CustomersController.create);
router.get('/:id', CustomersController.getById);
router.patch('/:id', authorize(['ADMIN', 'OUTLET']), validate({ body: updateCustomerSchema }), CustomersController.update);
router.get('/:id/purchases', CustomersController.getPurchaseHistory);

export default router;
