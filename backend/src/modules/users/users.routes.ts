import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// Only ADMIN can manage users
router.use(authenticate, authorize(['ADMIN']));

router.get('/', UsersController.list);
router.post('/', UsersController.create);
router.patch('/:id', UsersController.update);

export default router;
