import { Router } from 'express';
import { ProductsController } from './products.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import {
  createCategorySchema,
  createSubcategorySchema,
  createProductSchema,
  updateProductSchema,
  createPackConfigSchema,
  productQuerySchema,
} from './products.validation.js';

const router = Router();

router.use(authenticate);

// Categories
router.get('/categories', ProductsController.listCategories);
router.post('/categories', authorize(['ADMIN']), validate({ body: createCategorySchema }), ProductsController.createCategory);

// Subcategories
router.get('/subcategories', ProductsController.listSubcategories);
router.post('/subcategories', authorize(['ADMIN']), validate({ body: createSubcategorySchema }), ProductsController.createSubcategory);

// Units
router.get('/units', ProductsController.listUnits);

// Products
router.get('/products', validate({ query: productQuerySchema }), ProductsController.listProducts);
router.get('/products/:id', ProductsController.getProductById);
router.post('/products', authorize(['ADMIN']), validate({ body: createProductSchema }), ProductsController.createProduct);
router.patch('/products/:id', authorize(['ADMIN']), validate({ body: updateProductSchema }), ProductsController.updateProduct);
router.post('/products/pack-configs', authorize(['ADMIN']), validate({ body: createPackConfigSchema }), ProductsController.addPackConfiguration);

export default router;
