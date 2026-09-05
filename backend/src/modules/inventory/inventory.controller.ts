import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service.js';

export class InventoryController {
  static async getStockStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.getStockStatus(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.getMovements(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.adjustStock(req.user!.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async reconcileStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.reconcileStock(req.params.productId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
