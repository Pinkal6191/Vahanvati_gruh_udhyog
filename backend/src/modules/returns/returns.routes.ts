import { Router } from 'express';
import { ReturnsController } from './returns.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { createReturnSchema, returnsQuerySchema } from './returns.validation.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(['ADMIN', 'OUTLET']), validate({ body: createReturnSchema }), ReturnsController.createReturn);
router.get('/', validate({ query: returnsQuerySchema }), ReturnsController.listReturns);
router.get('/:id', ReturnsController.getById);

export default router;
