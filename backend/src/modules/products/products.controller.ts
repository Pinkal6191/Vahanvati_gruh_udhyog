import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service.js';

export class ProductsController {
  // ==========================================
  // CATEGORIES
  // ==========================================

  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.listCategories(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.getCategoryById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.createCategory(req.body, req.user?.id, req.user?.role);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateCategory(req.params.id, req.body, req.user?.id, req.user?.role);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateCategoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateCategoryStatus(
        req.params.id,
        req.body.isActive,
        req.user?.id,
        req.user?.role
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // SUBCATEGORIES
  // ==========================================

  static async listSubcategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.listSubcategories(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getSubcategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.getSubcategoryById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.createSubcategory(req.body, req.user?.id, req.user?.role);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateSubcategory(req.params.id, req.body, req.user?.id, req.user?.role);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateSubcategoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateSubcategoryStatus(
        req.params.id,
        req.body.isActive,
        req.user?.id,
        req.user?.role
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // UNITS
  // ==========================================

  static async listUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.listUnits(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getUnitById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.getUnitById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.createUnit(req.body, req.user?.id, req.user?.role);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateUnit(req.params.id, req.body, req.user?.id, req.user?.role);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateUnitStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateUnitStatus(
        req.params.id,
        req.body.isActive,
        req.user?.id,
        req.user?.role
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // PRODUCTS
  // ==========================================

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
      const result = await ProductsService.createProduct(req.body, req.user?.id, req.user?.role);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateProduct(req.params.id, req.body, req.user?.id, req.user?.role);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateProductStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.updateProductStatus(
        req.params.id,
        req.body.isActive,
        req.user?.id,
        req.user?.role
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async addPackConfiguration(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductsService.addPackConfiguration(req.body, req.user?.id, req.user?.role);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
