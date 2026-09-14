import { Router } from 'express';
import { WebsiteController } from './website.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

// ========================================================
// PUBLIC ROUTES (No Authentication Required)
// ========================================================
export const publicRoutes = Router();

publicRoutes.get('/home', WebsiteController.getPublicHome);
publicRoutes.get('/about', WebsiteController.getPublicAbout);
publicRoutes.get('/products', WebsiteController.getPublicProducts);
publicRoutes.get('/products/:id', WebsiteController.getPublicProductDetail);
publicRoutes.get('/gallery', WebsiteController.getPublicGallery);
publicRoutes.get('/contact', WebsiteController.getPublicContact);

// ========================================================
// CMS ADMIN ROUTES (Guarded by authenticate + ADMIN role)
// ========================================================
export const cmsRoutes = Router();

cmsRoutes.use(authenticate);
cmsRoutes.use(authorize(['ADMIN']));

// Website section contents
cmsRoutes.get('/content/:section', WebsiteController.getWebsiteContent);
cmsRoutes.put('/content/:section', WebsiteController.updateWebsiteContent);

// Product website catalog management
cmsRoutes.get('/products', WebsiteController.getCmsProducts);
cmsRoutes.patch('/products/:id/visibility', WebsiteController.updateProductWebsiteStatus);

// Gallery management
cmsRoutes.get('/gallery', WebsiteController.getCmsGallery);
cmsRoutes.post('/gallery', WebsiteController.createGalleryItem);
cmsRoutes.patch('/gallery/:id', WebsiteController.updateGalleryItem);
cmsRoutes.delete('/gallery/:id', WebsiteController.deleteGalleryItem);

// Contact and store settings
cmsRoutes.patch('/contact', WebsiteController.updateContactSettings);

export default { publicRoutes, cmsRoutes };
