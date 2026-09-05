import { Router } from 'express';
import { ProductsController } from './products.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  subcategoryQuerySchema,
  createUnitSchema,
  updateUnitSchema,
  unitQuerySchema,
  createProductSchema,
  updateProductSchema,
  createPackConfigSchema,
  productQuerySchema,
  updateStatusSchema,
} from './products.validation.js';

const router = Router();

router.use(authenticate);

// ==========================================
// CATEGORIES
// ==========================================
router.get('/categories', validate({ query: categoryQuerySchema }), ProductsController.listCategories);
router.get('/categories/:id', ProductsController.getCategoryById);
router.post(
  '/categories',
  authorize(['ADMIN']),
  validate({ body: createCategorySchema }),
  ProductsController.createCategory
);
router.patch(
  '/categories/:id',
  authorize(['ADMIN']),
  validate({ body: updateCategorySchema }),
  ProductsController.updateCategory
);
router.patch(
  '/categories/:id/status',
  authorize(['ADMIN']),
  validate({ body: updateStatusSchema }),
  ProductsController.updateCategoryStatus
);

// ==========================================
// SUBCATEGORIES
// ==========================================
router.get('/subcategories', validate({ query: subcategoryQuerySchema }), ProductsController.listSubcategories);
router.get('/subcategories/:id', ProductsController.getSubcategoryById);
router.post(
  '/subcategories',
  authorize(['ADMIN']),
  validate({ body: createSubcategorySchema }),
  ProductsController.createSubcategory
);
router.patch(
  '/subcategories/:id',
  authorize(['ADMIN']),
  validate({ body: updateSubcategorySchema }),
  ProductsController.updateSubcategory
);
router.patch(
  '/subcategories/:id/status',
  authorize(['ADMIN']),
  validate({ body: updateStatusSchema }),
  ProductsController.updateSubcategoryStatus
);

// ==========================================
// UNITS
// ==========================================
router.get('/units', validate({ query: unitQuerySchema }), ProductsController.listUnits);
router.get('/units/:id', ProductsController.getUnitById);
router.post(
  '/units',
  authorize(['ADMIN']),
  validate({ body: createUnitSchema }),
  ProductsController.createUnit
);
router.patch(
  '/units/:id',
  authorize(['ADMIN']),
  validate({ body: updateUnitSchema }),
  ProductsController.updateUnit
);
router.patch(
  '/units/:id/status',
  authorize(['ADMIN']),
  validate({ body: updateStatusSchema }),
  ProductsController.updateUnitStatus
);

// ==========================================
// PRODUCTS
// ==========================================
router.get('/products', validate({ query: productQuerySchema }), ProductsController.listProducts);
router.get('/products/:id', ProductsController.getProductById);
router.post(
  '/products',
  authorize(['ADMIN']),
  validate({ body: createProductSchema }),
  ProductsController.createProduct
);
router.patch(
  '/products/:id',
  authorize(['ADMIN']),
  validate({ body: updateProductSchema }),
  ProductsController.updateProduct
);
router.patch(
  '/products/:id/status',
  authorize(['ADMIN']),
  validate({ body: updateStatusSchema }),
  ProductsController.updateProductStatus
);
router.post(
  '/products/pack-configs',
  authorize(['ADMIN']),
  validate({ body: createPackConfigSchema }),
  ProductsController.addPackConfiguration
);

export default router;
