import { Request, Response, NextFunction } from 'express';
import { WebsiteService } from './website.service.js';
import { BadRequestError } from '../../common/errors/app-error.js';

export class WebsiteController {
  // ========================================================
  // PUBLIC CONTROLLERS
  // ========================================================

  static async getPublicHome(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WebsiteService.getPublicHome();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicAbout(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WebsiteService.getPublicAbout();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const subcategoryId = req.query.subcategoryId as string | undefined;

      const data = await WebsiteService.getPublicProducts({ search, categoryId, subcategoryId });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicProductDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await WebsiteService.getPublicProductDetail(id);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicGallery(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as string | undefined;
      const data = await WebsiteService.getPublicGallery(type);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicContact(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WebsiteService.getPublicContact();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WebsiteService.getPublicSettings();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================================
  // CMS ADMIN CONTROLLERS
  // ========================================================

  static async getWebsiteContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { section } = req.params;
      const data = await WebsiteService.getWebsiteContent(section);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateWebsiteContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { section } = req.params;
      const { content } = req.body;
      const userId = (req as any).user?.id;

      const result = await WebsiteService.updateWebsiteContent(section, content, userId);
      res.status(200).json({
        success: true,
        message: `${section} content updated successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCmsProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const isWebsiteVisible =
        req.query.isWebsiteVisible !== undefined
          ? req.query.isWebsiteVisible === 'true'
          : undefined;

      const data = await WebsiteService.getCmsProducts({ search, categoryId, isWebsiteVisible });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProductWebsiteStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isWebsiteVisible, isFeatured, description, imageUrl } = req.body;

      const updated = await WebsiteService.updateProductWebsiteStatus(id, {
        isWebsiteVisible,
        isFeatured,
        description,
        imageUrl,
      });

      res.status(200).json({
        success: true,
        message: 'Product website status updated',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCmsGallery(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WebsiteService.getCmsGallery();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createGalleryItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await WebsiteService.createGalleryItem(req.body);
      res.status(201).json({
        success: true,
        message: 'Gallery item created',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateGalleryItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await WebsiteService.updateGalleryItem(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Gallery item updated',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteGalleryItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await WebsiteService.deleteGalleryItem(id);
      res.status(200).json({
        success: true,
        message: 'Gallery item deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCmsSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WebsiteService.getCmsSettings();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCmsSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const updated = await WebsiteService.updateCmsSettings(req.body, userId);
      res.status(200).json({
        success: true,
        message: 'Website settings updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateContactSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const updated = await WebsiteService.updateContactSettings(req.body, userId);
      res.status(200).json({
        success: true,
        message: 'Contact settings updated',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        throw new BadRequestError('No file provided for upload');
      }

      const isVideo = file.mimetype.startsWith('video/');
      const mediaType: 'IMAGE' | 'VIDEO' = isVideo ? 'VIDEO' : 'IMAGE';
      const relativeUrl = `/uploads/${file.filename}`;

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          url: relativeUrl,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          mediaType,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
