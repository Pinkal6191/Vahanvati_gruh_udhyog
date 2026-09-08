import { Request, Response, NextFunction } from 'express';
import { ProductionService } from './production.service.js';

export class ProductionController {
  static async createEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductionService.createEntry(
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

  static async listEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductionService.listEntries(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductionService.getProductionSummary();
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductionService.getById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductionService.updateEntry(
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

  static async completeProduction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductionService.completeProduction(
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

  static async cancelProduction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductionService.cancelProduction(
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
