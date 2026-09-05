import { Router } from 'express';
import { SettingsController } from './settings.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', SettingsController.getSettings);
router.patch('/', authorize(['ADMIN']), SettingsController.updateSettings);

export default router;
