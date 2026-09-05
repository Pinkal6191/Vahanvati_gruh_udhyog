import { Request, Response, NextFunction } from 'express';
import { PricingService } from './pricing.service.js';

export class PricingController {
  static async getProductPrices(req: Request, res: Response, next: NextFunction) {
    try {
      const prices = await PricingService.getProductPrices(req.params.productId);
      res.status(200).json({ success: true, data: prices });
    } catch (err) {
      next(err);
    }
  }

  static async upsertPrice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PricingService.upsertPrice(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async batchUpsert(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PricingService.batchUpsert(req.body.prices);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async resolveCart(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await PricingService.resolveCart(req.body);
      res.status(200).json({ success: true, data: resolved });
    } catch (err) {
      next(err);
    }
  }
}
