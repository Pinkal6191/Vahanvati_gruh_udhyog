import { Request, Response, NextFunction } from 'express';
import { PricingService } from './pricing.service.js';

export class PricingController {
  static async createPrice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PricingService.createPrice(
        req.body,
        (req as any).user?.id,
        (req as any).user?.role,
        req.ip
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updatePrice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PricingService.updatePrice(
        req.params.id,
        req.body,
        (req as any).user?.id,
        (req as any).user?.role,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = req.body;
      const result = await PricingService.togglePriceStatus(
        req.params.id,
        isActive,
        (req as any).user?.id,
        (req as any).user?.role,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getCurrentPrices(req: Request, res: Response, next: NextFunction) {
    try {
      const prices = await PricingService.getCurrentPrices(req.query as any);
      res.status(200).json({ success: true, data: prices });
    } catch (err) {
      next(err);
    }
  }

  static async getPriceHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await PricingService.getPriceHistory(
        req.params.productId,
        req.query.customerType as any
      );
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  static async resolvePrice(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await PricingService.resolveApplicablePrice(req.body);
      res.status(200).json({ success: true, data: resolved });
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

  static async batchUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PricingService.batchUpdatePrices(
        req.body.prices,
        (req as any).user?.id,
        (req as any).user?.role,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
