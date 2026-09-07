export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Vahanvati Gruh Udhyog — Master Data & Core API Documentation',
    version: '1.0.0',
    description:
      'REST API backend for Vahanvati Gruh Udhyog Billing, Production & Business Management Software. Step 3 Master Data Module specification covering Categories, Subcategories, Units, Products, and Customers.',
    contact: {
      name: 'Vahanvati Tech Team',
      email: 'tech@vahanvati.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000/api/v1',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT Access Token obtained from /auth/login',
      },
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'BAD_REQUEST' },
              message: { type: 'string', example: 'Validation failed or constraint violation' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Farsan' },
          code: { type: 'string', example: 'FARSAN' },
          displayOrder: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
        },
      },
      Subcategory: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Dry Snacks' },
          code: { type: 'string', example: 'DRY_SNACKS' },
          displayOrder: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
        },
      },
      Unit: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Kilogram' },
          symbol: { type: 'string', example: 'kg' },
          isWeightBased: { type: 'boolean', example: true },
          conversionFactorToBase: { type: 'number', example: 1000.0 },
          isActive: { type: 'boolean', example: true },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          subcategoryId: { type: 'string', format: 'uuid' },
          primaryUnitId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Papdi (Farsan)' },
          gujaratiName: { type: 'string', example: 'પાપડી' },
          code: { type: 'string', example: 'PAPDI' },
          barcode: { type: 'string', example: '890123456701' },
          isLooseWeightAllowed: { type: 'boolean', example: true },
          isActive: { type: 'boolean', example: true },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Rameshbhai Patel' },
          customerType: { type: 'string', enum: ['INDIAN', 'NRI'], example: 'INDIAN' },
          mobile: { type: 'string', example: '9825012345' },
          email: { type: 'string', example: 'ramesh@example.com' },
          gstin: { type: 'string', example: '24AAAAA0000A1Z5' },
          city: { type: 'string', example: 'Ahmedabad' },
          country: { type: 'string', example: 'India' },
          isActive: { type: 'boolean', example: true },
        },
      },
      ProductPrice: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          productId: { type: 'string', format: 'uuid' },
          packConfigId: { type: 'string', format: 'uuid', nullable: true },
          customerType: { type: 'string', enum: ['INDIAN', 'NRI'], example: 'INDIAN' },
          rate: { type: 'number', example: 350.0 },
          effectiveFrom: { type: 'string', format: 'date-time' },
          effectiveTo: { type: 'string', format: 'date-time', nullable: true },
          isActive: { type: 'boolean', example: true },
          createdById: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      ResolvedItem: {
        type: 'object',
        properties: {
          productId: { type: 'string', format: 'uuid' },
          productName: { type: 'string', example: 'Chorafali' },
          gujaratiName: { type: 'string', example: 'ચોરાફળી' },
          packConfigId: { type: 'string', format: 'uuid', nullable: true },
          weightOrPackName: { type: 'string', example: '500 GM Pack' },
          unitSymbol: { type: 'string', example: 'kg' },
          quantity: { type: 'number', example: 2 },
          baseWeightDeducted: { type: 'number', example: 1000 },
          unitRate: { type: 'number', example: 180.0 },
          totalAmount: { type: 'number', example: 360.0 },
          customerType: { type: 'string', enum: ['INDIAN', 'NRI'] },
        },
      },
      Sale: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          billNumber: { type: 'string', example: 'VGU-20260907-0001' },
          customerId: { type: 'string', format: 'uuid' },
          customerNameSnapshot: { type: 'string', example: 'Walk-in Customer' },
          customerMobileSnapshot: { type: 'string', nullable: true },
          totalItemsCount: { type: 'integer', example: 2 },
          subtotalAmount: { type: 'number', example: 450.0 },
          discountAmount: { type: 'number', example: 0.0 },
          finalTotalAmount: { type: 'number', example: 450.0 },
          paidAmount: { type: 'number', example: 500.0 },
          changeReturned: { type: 'number', example: 50.0 },
          paymentStatus: { type: 'string', example: 'PAID' },
          saleStatus: { type: 'string', example: 'COMPLETED' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SaleItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          productId: { type: 'string', format: 'uuid' },
          productNameSnapshot: { type: 'string', example: 'Chorafali' },
          weightOrPackSnapshot: { type: 'string', example: '500 GM Pack' },
          quantity: { type: 'number', example: 2 },
          unitRate: { type: 'number', example: 180.0 },
          total: { type: 'number', example: 360.0 },
        },
      },
      SalePayment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          paymentMode: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'OTHER'], example: 'CASH' },
          amount: { type: 'number', example: 450.0 },
          transactionReference: { type: 'string', nullable: true },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System Health Check',
        responses: { '200': { description: 'System healthy' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login User',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Authenticated' } },
      },
    },
    '/catalog/categories': {
      get: {
        summary: 'List Categories',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'all'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Categories list' } },
      },
      post: {
        summary: 'Create Category (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code'],
                properties: {
                  name: { type: 'string', example: 'Sweets' },
                  code: { type: 'string', example: 'SWEETS' },
                  displayOrder: { type: 'integer', default: 0 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Category created' } },
      },
    },
    '/catalog/categories/{id}/status': {
      patch: {
        summary: 'Activate/Deactivate Category (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } } } },
        },
        responses: { '200': { description: 'Status updated' } },
      },
    },
    '/catalog/subcategories': {
      get: {
        summary: 'List Subcategories',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'all'] } },
        ],
        responses: { '200': { description: 'Subcategories list' } },
      },
      post: {
        summary: 'Create Subcategory (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['categoryId', 'name', 'code'],
                properties: {
                  categoryId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', example: 'Milk Sweets' },
                  code: { type: 'string', example: 'MILK_SWEETS' },
                  displayOrder: { type: 'integer', default: 0 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Subcategory created' } },
      },
    },
    '/catalog/units': {
      get: {
        summary: 'List Units / Weights',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Units list' } },
      },
      post: {
        summary: 'Create Unit (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'symbol'],
                properties: {
                  name: { type: 'string', example: 'Box' },
                  symbol: { type: 'string', example: 'box' },
                  isWeightBased: { type: 'boolean', default: false },
                  conversionFactorToBase: { type: 'number', default: 1.0 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Unit created' } },
      },
    },
    '/catalog/products': {
      get: {
        summary: 'List Products (with search, category/subcategory filter, and stock)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'subcategoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'all'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated product list' } },
      },
      post: {
        summary: 'Create Product with Hierarchy Validation (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subcategoryId', 'primaryUnitId', 'name', 'code'],
                properties: {
                  categoryId: { type: 'string', format: 'uuid', description: 'Optional: If provided, backend validates that subcategoryId belongs to it' },
                  subcategoryId: { type: 'string', format: 'uuid' },
                  primaryUnitId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', example: 'Fafda' },
                  gujaratiName: { type: 'string', example: 'ફાફડા' },
                  code: { type: 'string', example: 'FAFDA' },
                  barcode: { type: 'string', example: '890123456709' },
                  isLooseWeightAllowed: { type: 'boolean', default: true },
                  minimumStockThreshold: { type: 'number', default: 0 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Product created' }, '400': { description: 'Hierarchy mismatch or validation error' } },
      },
    },
    '/catalog/products/{id}/status': {
      patch: {
        summary: 'Activate/Deactivate Product (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } } } },
        },
        responses: { '200': { description: 'Product status updated' } },
      },
    },
    '/customers': {
      get: {
        summary: 'List / Search Customers',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['INDIAN', 'NRI'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'all'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Customer list' } },
      },
      post: {
        summary: 'Create Customer (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Hasmukh Patel' },
                  customerType: { type: 'string', enum: ['INDIAN', 'NRI'], default: 'INDIAN' },
                  mobile: { type: 'string', example: '+91 98250 99999' },
                  email: { type: 'string', example: 'hasmukh@example.com' },
                  gstin: { type: 'string', example: '24ABCDE1234F1Z5' },
                  city: { type: 'string', example: 'Ahmedabad' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Customer created' } },
      },
    },
    '/customers/{id}/status': {
      patch: {
        summary: 'Activate/Deactivate Customer (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } } } },
        },
        responses: { '200': { description: 'Customer status updated' } },
      },
    },
    '/audit-logs': {
      get: {
        summary: 'View Audit Logs (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'entityId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Audit log entries' } },
      },
    },
    '/pricing': {
      post: {
        summary: 'Create Product Price (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'customerType', 'rate'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  packConfigId: { type: 'string', format: 'uuid', nullable: true },
                  customerType: { type: 'string', enum: ['INDIAN', 'NRI'] },
                  rate: { type: 'number', example: 350.0 },
                  effectiveFrom: { type: 'string', format: 'date-time' },
                  effectiveTo: { type: 'string', format: 'date-time', nullable: true },
                  isActive: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Price created successfully' },
          '400': { description: 'Validation error or overlapping period' },
          '403': { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/pricing/{id}': {
      put: {
        summary: 'Update Product Price (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rate: { type: 'number', example: 380.0 },
                  effectiveFrom: { type: 'string', format: 'date-time' },
                  effectiveTo: { type: 'string', format: 'date-time', nullable: true },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Price updated successfully' },
          '400': { description: 'Validation error or overlapping period' },
          '403': { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/pricing/{id}/status': {
      patch: {
        summary: 'Toggle Price Active Status (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isActive'],
                properties: { isActive: { type: 'boolean' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Price status updated' } },
      },
    },
    '/pricing/current': {
      get: {
        summary: 'Get Current Applicable Prices (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'customerType', in: 'query', schema: { type: 'string', enum: ['INDIAN', 'NRI'] } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Current active prices' } },
      },
    },
    '/pricing/history/{productId}': {
      get: {
        summary: 'Get Price History for a Product (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'customerType', in: 'query', schema: { type: 'string', enum: ['INDIAN', 'NRI'] } },
        ],
        responses: { '200': { description: 'Chronological price records' } },
      },
    },
    '/pricing/resolve': {
      post: {
        summary: 'Resolve Applicable Price for Item (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'customerType'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  customerType: { type: 'string', enum: ['INDIAN', 'NRI'] },
                  packConfigId: { type: 'string', format: 'uuid', nullable: true },
                  looseWeightInGrams: { type: 'number', nullable: true },
                  quantity: { type: 'number', default: 1 },
                  targetDate: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Resolved price and calculated total' },
          '400': { description: 'Pricing not configured for customer type or product inactive' },
        },
      },
    },
    '/pricing/resolve-cart': {
      post: {
        summary: 'Resolve Complete Cart Rates (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  customerId: { type: 'string', format: 'uuid', nullable: true },
                  customerType: { type: 'string', enum: ['INDIAN', 'NRI'] },
                  targetDate: { type: 'string', format: 'date-time' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'quantity'],
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        packConfigId: { type: 'string', format: 'uuid', nullable: true },
                        quantity: { type: 'number' },
                        looseWeightInGrams: { type: 'number', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Resolved cart with line items and total' } },
      },
    },
    '/pricing/batch': {
      post: {
        summary: 'Atomic Batch Update / Create Prices (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prices'],
                properties: {
                  prices: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'customerType', 'rate'],
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        packConfigId: { type: 'string', format: 'uuid', nullable: true },
                        customerType: { type: 'string', enum: ['INDIAN', 'NRI'] },
                        rate: { type: 'number' },
                        effectiveFrom: { type: 'string', format: 'date-time' },
                        effectiveTo: { type: 'string', format: 'date-time', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Batch update succeeded' },
          '400': { description: 'Batch transaction rolled back due to error' },
        },
      },
    },
    '/sales': {
      post: {
        summary: 'Create Sale / Complete POS Checkout (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items', 'payments', 'paidAmount'],
                properties: {
                  customerId: { type: 'string', format: 'uuid', nullable: true },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'quantity'],
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        packConfigId: { type: 'string', format: 'uuid', nullable: true },
                        quantity: { type: 'number', example: 2 },
                        looseWeightInGrams: { type: 'number', nullable: true },
                      },
                    },
                  },
                  discountAmount: { type: 'number', default: 0 },
                  paidAmount: { type: 'number', example: 500.0 },
                  payments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['paymentMode', 'amount'],
                      properties: {
                        paymentMode: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'OTHER'] },
                        amount: { type: 'number', example: 450.0 },
                        transactionReference: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Sale completed successfully' },
          '400': { description: 'Validation error, insufficient payment, or missing price' },
          '403': { description: 'Forbidden (Production role blocked)' },
        },
      },
      get: {
        summary: 'List & Search Sales History (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'billNumber', in: 'query', schema: { type: 'string' } },
          { name: 'customerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'saleStatus', in: 'query', schema: { type: 'string', enum: ['COMPLETED', 'CANCELLED'] } },
          { name: 'paymentMode', in: 'query', schema: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'OTHER'] } },
          { name: 'date', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string' } },
          { name: 'endDate', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated sales list' } },
      },
    },
    '/sales/{id}': {
      get: {
        summary: 'Get Sale by ID (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Sale details with items and payments' } },
      },
    },
    '/sales/bill/{billNumber}': {
      get: {
        summary: 'Get Sale by Bill Number (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'billNumber', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Sale details' } },
      },
    },
    '/sales/{id}/print': {
      get: {
        summary: 'Get 3-inch Thermal Print Receipt Data (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Thermal receipt formatted payload' } },
      },
    },
    '/sales/{id}/cancel': {
      post: {
        summary: 'Cancel Sale & Reverse Stock (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', example: 'Customer returned items immediately' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Sale cancelled and stock reversed' },
          '400': { description: 'Sale already cancelled' },
          '403': { description: 'Forbidden (Admin only)' },
        },
      },
    },
  },
};
