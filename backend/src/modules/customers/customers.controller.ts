import { Request, Response, NextFunction } from 'express';
import { CustomersService } from './customers.service.js';

export class CustomersController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CustomersService.list(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await CustomersService.getById(req.params.id);
      res.status(200).json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await CustomersService.create(req.body, req.user?.id, req.user?.role);
      res.status(201).json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await CustomersService.update(req.params.id, req.body, req.user?.id, req.user?.role);
      res.status(200).json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await CustomersService.updateStatus(
        req.params.id,
        req.body.isActive,
        req.user?.id,
        req.user?.role
      );
      res.status(200).json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  static async getPurchaseHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const history = await CustomersService.getPurchaseHistory(req.params.id, page, limit);
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
}
