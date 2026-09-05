import { Router, Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate, authorize(['ADMIN']));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuditService.list(req.query as any);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
