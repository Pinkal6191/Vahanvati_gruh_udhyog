import { Request, Response, NextFunction } from 'express';
import { ReturnsService } from './returns.service.js';

export class ReturnsController {
  static async createReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.createReturn(
        req.user!.id,
        req.body,
        req.user?.role,
        req.ip
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getReturnPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.getReturnPreview(req.params.saleId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.getReturnSummary();
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.getById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.listReturns(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.updateReturn(
        req.params.id,
        req.user!.id,
        req.body,
        req.user?.role,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async completeReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.completeReturn(
        req.params.id,
        req.user!.id,
        req.user?.role,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async cancelReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.cancelReturn(
        req.params.id,
        req.user!.id,
        req.body,
        req.user?.role,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
