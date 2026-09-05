import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service.js';

export class ProductsController {
  // Categories
  static async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.listCategories();
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.createCategory(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Subcategories
  static async listSubcategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const result = await ProductsService.listSubcategories(categoryId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.createSubcategory(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Units
  static async listUnits(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.listUnits();
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Products
  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.listProducts(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.getProductById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.createProduct(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateProduct(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async addPackConfiguration(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.addPackConfiguration(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
