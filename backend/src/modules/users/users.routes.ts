import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createUserSchema, updateUserSchema } from './users.validation.js';

const router = Router();

// Only ADMIN can manage users
router.use(authenticate, authorize(['ADMIN']));

router.get('/', UsersController.list);
router.post('/', validate({ body: createUserSchema }), UsersController.create);
router.put('/:id', validate({ body: updateUserSchema }), UsersController.update);
router.patch('/:id', validate({ body: updateUserSchema }), UsersController.update);

export default router;
