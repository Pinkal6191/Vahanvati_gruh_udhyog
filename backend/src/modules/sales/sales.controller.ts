import { Request, Response, NextFunction } from 'express';
import { SalesService } from './sales.service.js';

export class SalesController {
  static async createSale(req: Request, res: Response, next: NextFunction) {
    try {
      const sale = await SalesService.createSale(
        (req as any).user!.id,
        (req as any).user!.role,
        req.body,
        req.ip
      );
      res.status(201).json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  }

  static async cancelSale(req: Request, res: Response, next: NextFunction) {
    try {
      const cancelled = await SalesService.cancelSale(
        req.params.id,
        (req as any).user!.id,
        (req as any).user!.role,
        req.body,
        req.ip
      );
      res.status(200).json({ success: true, data: cancelled });
    } catch (err) {
      next(err);
    }
  }

  static async getSaleById(req: Request, res: Response, next: NextFunction) {
    try {
      const sale = await SalesService.getSaleById(req.params.id);
      res.status(200).json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  }

  static async getSaleByBillNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const billNumber = req.params.billNumber;
      const sale = await SalesService.getSaleByBillNumber(billNumber);
      res.status(200).json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  }

  static async listSales(req: Request, res: Response, next: NextFunction) {
    try {
      const sales = await SalesService.listSales(req.query as any);
      res.status(200).json({ success: true, data: sales });
    } catch (err) {
      next(err);
    }
  }

  static async getPrintPayload(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = await SalesService.getPrintPayload(req.params.id);
      res.status(200).json({ success: true, data: payload });
    } catch (err) {
      next(err);
    }
  }
}
