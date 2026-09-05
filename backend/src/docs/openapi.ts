export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Vahanvati Gruh Udhyog — API Documentation',
    version: '1.0.0',
    description:
      'REST API backend for Vahanvati Gruh Udhyog Billing, Production & Business Management Software. Built with Node.js, Express, TypeScript, and PostgreSQL.',
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
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid credentials or request data' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'outlet' },
          password: { type: 'string', example: 'outlet123' },
        },
      },
      UserResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', example: 'outlet' },
          fullName: { type: 'string', example: 'Counter Staff' },
          role: { type: 'string', enum: ['ADMIN', 'OUTLET', 'PRODUCTION'] },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Rameshbhai Patel' },
          customerType: { type: 'string', enum: ['INDIAN', 'NRI'], example: 'INDIAN' },
          mobile: { type: 'string', example: '9825012345' },
          city: { type: 'string', example: 'Ahmedabad' },
          country: { type: 'string', example: 'India' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System Health Check',
        description: 'Returns operational status of API and PostgreSQL database connection.',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    service: { type: 'string', example: 'Vahanvati Gruh Udhyog Backend' },
                    database: { type: 'string', example: 'connected' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'User Login',
        description: 'Authenticates user with username & password. Returns JWT Access Token (15m) and Refresh Token (7d).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/UserResponse' },
                        tokens: {
                          type: 'object',
                          properties: {
                            accessToken: { type: 'string' },
                            refreshToken: { type: 'string' },
                            expiresIn: { type: 'string', example: '15m' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Current User Profile',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'User profile returned',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/customers': {
      get: {
        summary: 'List / Search Customers',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name or mobile' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['INDIAN', 'NRI'] } },
        ],
        responses: {
          '200': { description: 'Paginated customer list' },
        },
      },
      post: {
        summary: 'Create Customer',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Pravin Patel' },
                  customerType: { type: 'string', enum: ['INDIAN', 'NRI'], default: 'INDIAN' },
                  mobile: { type: 'string', example: '+91 98250 12345' },
                  city: { type: 'string', example: 'Ahmedabad' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Customer created' },
        },
      },
    },
    '/catalog/products': {
      get: {
        summary: 'List Products with Packs & Current Stock',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'subcategoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'List of products' },
        },
      },
    },
    '/pricing/resolve-cart': {
      post: {
        summary: 'Authoritative Price Resolution',
        description: 'Calculates true server prices based on customer tier (Indian vs NRI) without exposing tier markup to customers.',
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
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'quantity'],
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        packConfigId: { type: 'string', format: 'uuid', nullable: true },
                        quantity: { type: 'number', example: 2 },
                        looseWeightInGrams: { type: 'number', example: 340, nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authoritative cart pricing' },
        },
      },
    },
  },
};
