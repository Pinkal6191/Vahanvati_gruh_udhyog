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
        summary: 'Cancel Sale & Reverse Stock (Admin & Outlet)',
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
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/inventory/status': {
      get: {
        summary: 'List Inventory Stock Balances (Admin, Outlet, Production)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'lowStockOnly', in: 'query', schema: { type: 'boolean' } },
          { name: 'outOfStockOnly', in: 'query', schema: { type: 'boolean' } },
          { name: 'subcategoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Stock list with pagination' } },
      },
    },
    '/inventory/summary': {
      get: {
        summary: 'Inventory Dashboard Summary (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Total active products, in-stock, low-stock, out-of-stock counts and recent movements' } },
      },
    },
    '/inventory/product/{productId}': {
      get: {
        summary: 'Get Product Stock Details (Admin, Outlet, Production)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Product stock balance and threshold details' },
          '404': { description: 'Product not found' },
        },
      },
    },
    '/inventory/movements': {
      get: {
        summary: 'Get Chronological Stock Movements Ledger (Admin & Outlet)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'movementType', in: 'query', schema: { type: 'string', enum: ['SALE_OUT', 'SALES_RETURN_IN', 'PRODUCTION_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] } },
          { name: 'referenceType', in: 'query', schema: { type: 'string', enum: ['SALE', 'SALES_RETURN', 'PRODUCTION', 'MANUAL'] } },
          { name: 'referenceId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Paginated stock movements' } },
      },
    },
    '/inventory/adjust': {
      post: {
        summary: 'Manual Stock Adjustment with Audit Trail (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'quantityDelta', 'reason'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantityDelta: { type: 'number', example: 500, description: 'Positive for inward (+), Negative for outward (-)' },
                  reason: { type: 'string', minLength: 3, example: 'Physical stock count correction' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Stock adjusted and ledger recorded' },
          '400': { description: 'Validation error or zero delta' },
          '403': { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/inventory/reconcile/{productId}': {
      get: {
        summary: 'Reconcile Authoritative Cached Balance with Movement Ledger Sum (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Reconciliation status showing cachedBalance, ledgerTotal, and isConsistent' },
          '404': { description: 'Stock record not found' },
          '403': { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/production/summary': {
      get: {
        summary: 'Production summary metrics dashboard',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Summary metrics including today production weight, counts, and recent entries' },
        },
      },
    },
    '/production': {
      get: {
        summary: 'List production entries with filtering and pagination',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'batchNumber', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'COMPLETED', 'CANCELLED'] } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Paginated production entries' },
        },
      },
      post: {
        summary: 'Create a new production entry (DRAFT or COMPLETED)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'quantityProduced', 'unitId', 'productionDate'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantityProduced: { type: 'number', minimum: 0.001 },
                  unitId: { type: 'string', format: 'uuid' },
                  batchNumber: { type: 'string' },
                  productionDate: { type: 'string', format: 'date' },
                  expiryDate: { type: 'string', format: 'date' },
                  notes: { type: 'string' },
                  status: { type: 'string', enum: ['DRAFT', 'COMPLETED'], default: 'COMPLETED' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Production entry created successfully' },
          '400': { description: 'Validation error or unit incompatibility' },
          '403': { description: 'Forbidden (Production or Admin only)' },
        },
      },
    },
    '/production/{id}': {
      get: {
        summary: 'Get production entry by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Production entry details' },
          '404': { description: 'Production entry not found' },
        },
      },
      put: {
        summary: 'Update a draft production entry',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quantityProduced: { type: 'number', minimum: 0.001 },
                  unitId: { type: 'string', format: 'uuid' },
                  batchNumber: { type: 'string' },
                  productionDate: { type: 'string', format: 'date' },
                  expiryDate: { type: 'string', format: 'date' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Production draft updated successfully' },
          '400': { description: 'Validation error or entry not in DRAFT status' },
          '404': { description: 'Production entry not found' },
        },
      },
    },
    '/production/{id}/complete': {
      post: {
        summary: 'Complete a draft production entry and increment stock',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Production entry completed and stock incremented' },
          '400': { description: 'Entry already completed or cancelled' },
          '404': { description: 'Production entry not found' },
        },
      },
    },
    '/production/{id}/cancel': {
      post: {
        summary: 'Cancel a production entry (reverses stock if completed)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: {
                  reason: { type: 'string', minLength: 3 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Production entry cancelled successfully' },
          '400': { description: 'Entry already cancelled or validation error' },
          '404': { description: 'Production entry not found' },
        },
      },
    },
    '/sales-returns/preview/{saleId}': {
      get: {
        summary: 'Returnable preview for an original bill/sale',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'saleId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Breakdown of sold, returned, remaining returnable quantities and max refund' },
          '404': { description: 'Sale not found' },
        },
      },
    },
    '/sales-returns/summary': {
      get: {
        summary: 'Sales return metrics summary dashboard',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Summary metrics including today return count/amount, totals, and status breakdown' },
        },
      },
    },
    '/sales-returns': {
      get: {
        summary: 'List sales returns with rich filters and pagination',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'returnNumber', in: 'query', schema: { type: 'string' } },
          { name: 'originalBillNumber', in: 'query', schema: { type: 'string' } },
          { name: 'customerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'COMPLETED', 'CANCELLED'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Paginated sales returns list' },
        },
      },
      post: {
        summary: 'Create a new sales return (DRAFT or COMPLETED)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['originalSaleId', 'reason', 'items'],
                properties: {
                  originalSaleId: { type: 'string', format: 'uuid' },
                  reason: { type: 'string', minLength: 3 },
                  refundPaymentMode: { type: 'string', enum: ['CASH', 'UPI', 'STORE_CREDIT'], default: 'CASH' },
                  status: { type: 'string', enum: ['DRAFT', 'COMPLETED'], default: 'COMPLETED' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['saleItemId', 'returnedQuantity'],
                      properties: {
                        saleItemId: { type: 'string', format: 'uuid' },
                        returnedQuantity: { type: 'number', minimum: 0.001 },
                        restockCondition: { type: 'string', enum: ['RESTOCKABLE', 'DAMAGED_DISCARD'], default: 'RESTOCKABLE' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Sales return created successfully' },
          '400': { description: 'Exceeded returnable quantity, cancelled sale, or validation error' },
          '404': { description: 'Original sale or sale item not found' },
        },
      },
    },
    '/sales-returns/{id}': {
      get: {
        summary: 'Get detailed sales return by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Sales return details with nested items' },
          '404': { description: 'Sales return not found' },
        },
      },
      put: {
        summary: 'Update a draft sales return',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string', minLength: 3 },
                  refundPaymentMode: { type: 'string', enum: ['CASH', 'UPI', 'STORE_CREDIT'] },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['saleItemId', 'returnedQuantity'],
                      properties: {
                        saleItemId: { type: 'string', format: 'uuid' },
                        returnedQuantity: { type: 'number', minimum: 0.001 },
                        restockCondition: { type: 'string', enum: ['RESTOCKABLE', 'DAMAGED_DISCARD'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Draft sales return updated' },
          '400': { description: 'Return not in DRAFT status or validation error' },
          '404': { description: 'Sales return not found' },
        },
      },
    },
    '/sales-returns/{id}/complete': {
      post: {
        summary: 'Complete draft sales return and restock via StockService',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Sales return completed and stock incremented' },
          '400': { description: 'Return already completed/cancelled or quantity exceeded' },
          '404': { description: 'Sales return not found' },
        },
      },
    },
    '/sales-returns/{id}/cancel': {
      post: {
        summary: 'Cancel sales return (reverses stock if previously completed)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: {
                  reason: { type: 'string', minLength: 3 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Sales return cancelled and stock reversed if completed' },
          '400': { description: 'Return already cancelled or validation error' },
          '404': { description: 'Sales return not found' },
        },
      },
    },
    '/reports/sales': {
      get: {
        summary: 'Comprehensive sales report with time series and payment mode breakdown',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'groupBy', in: 'query', schema: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH'], default: 'DAY' } },
          { name: 'paymentMode', in: 'query', schema: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'OTHER'] } },
          { name: 'customerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Sales report data and metrics' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/reports/sales/products': {
      get: {
        summary: 'Product-wise sales aggregation and ranking',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'subcategoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['amount', 'quantity', 'bills'], default: 'amount' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': { description: 'Product-wise sales list and summary' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/reports/sales/customers': {
      get: {
        summary: 'Customer-wise sales report with repeat customer metrics',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'minBills', in: 'query', schema: { type: 'integer' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['purchases', 'bills', 'lastPurchase'], default: 'purchases' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': { description: 'Customer sales report and repeat customer metrics' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/reports/customers/{customerId}': {
      get: {
        summary: 'Detailed customer purchase history and past bills',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'customerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Customer purchase history' },
          '404': { description: 'Customer not found' },
        },
      },
    },
    '/reports/production': {
      get: {
        summary: 'Production report by product, status, and time series',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'COMPLETED', 'CANCELLED'] } },
          { name: 'groupBy', in: 'query', schema: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH'], default: 'DAY' } },
        ],
        responses: {
          '200': { description: 'Production report data and metrics' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/reports/stock': {
      get: {
        summary: 'Current stock inventory report with threshold classifications',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ALL', 'LOW_STOCK', 'OUT_OF_STOCK', 'IN_STOCK'], default: 'ALL' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'subcategoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': { description: 'Stock inventory report' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/reports/stock/movements': {
      get: {
        summary: 'Aggregated stock ledger movements report',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'movementType', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': { description: 'Stock movements report' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/reports/stock/reconciliation': {
      get: {
        summary: 'Admin audit: Zero-drift stock balance reconciliation report',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Reconciliation status across products' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/reports/returns': {
      get: {
        summary: 'Sales return report, refund breakdowns, and return rate against sales',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'productId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'COMPLETED', 'CANCELLED'] } },
          { name: 'refundPaymentMode', in: 'query', schema: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'CREDIT_NOTE'] } },
        ],
        responses: {
          '200': { description: 'Sales return report data' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/reports/business-summary': {
      get: {
        summary: 'Executive real-time business summary dashboard (KPIs, Net Sales, Top Products)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'Business summary dashboard metrics' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden (Admin only)' },
        },
      },
    },
  },
};


