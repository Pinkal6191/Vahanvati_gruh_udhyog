# Vahanvati Gruh Udhyog — Backend API Foundation (Step 2)

**Product:** Billing, Production & Business Management Software  
**Architecture:** Node.js, Express, TypeScript, PostgreSQL, Prisma ORM  

---

## 1. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment variables:
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `4000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `API_PREFIX` | REST API base route | `/api/v1` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user@localhost:5432/vahanvati_db?schema=public` |
| `JWT_ACCESS_SECRET` | Secret key for signing 15m access tokens | *(Change in production)* |
| `JWT_REFRESH_SECRET`| Secret key for signing 7d refresh tokens | *(Change in production)* |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000,http://localhost:5173` |

---

## 2. Database Setup & Migrations

PostgreSQL is accessed via Prisma ORM.

1. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

2. **Apply Migrations to Database:**
   ```bash
   npm run prisma:migrate
   ```

3. **Seed Database Foundation Data:**
   ```bash
   npm run prisma:seed
   ```
   *Seeds default roles (`admin`, `outlet`, `production`), units (Gram, KG, Piece), default walk-in customer, company settings, and catalog structure.*

4. **Visual Database Explorer (Prisma Studio):**
   ```bash
   npm run prisma:studio
   ```

---

## 3. Running the Server

- **Development Mode (with live reload):**
  ```bash
  npm run dev
  ```

- **Production Build & Run:**
  ```bash
  npm run build
  npm start
  ```

- **Health Endpoint:**  
  `GET http://localhost:4000/api/v1/health`

- **Interactive Swagger Documentation:**  
  `GET http://localhost:4000/api/v1/docs`

---

## 4. Running Automated Tests

- **Run Step 2 Foundation Tests:**
  ```bash
  npm test
  ```
  *(Tests DB health, password hashing, valid login, invalid login rejection, inactive user block, RBAC boundaries, Zod schema validation, and CRUD operations)*

- **Run Full End-to-End Business Flow Suite:**
  ```bash
  npm run test:all
  ```
  *(Tests Indian/NRI pricing resolution, loose weight scale math, atomic checkout, stock movement ledger, production entries, sales returns, zero-drift reconciliation, and historical price preservation)*

---

## 5. Project Folder Structure

```
backend/
├── src/
│   ├── app.ts                  # Express application setup, security middlewares, route mounting
│   ├── server.ts               # HTTP server bootstrap & graceful shutdown listeners
│   ├── config/
│   │   ├── env.ts              # Zod-validated environment config
│   │   └── database.ts         # PrismaClient singleton
│   ├── common/
│   │   └── errors/             # AppError, BadRequest, Unauthorized, Forbidden, NotFound, InsufficientStock
│   ├── middlewares/
│   │   ├── auth.middleware.ts  # JWT bearer token verification
│   │   ├── role.middleware.ts  # Server-side RBAC guards
│   │   ├── validate.middleware.ts # Zod request schema validator
│   │   └── error.middleware.ts # Unified error envelope (safe for production)
│   ├── docs/
│   │   └── openapi.ts          # OpenAPI 3.0 specification for Swagger UI
│   ├── modules/
│   │   ├── auth/               # Login, refresh, logout, profile
│   │   ├── users/              # User management (Admin only)
│   │   ├── customers/          # Indian vs. NRI customers & purchase history
│   │   ├── products/           # Categories, subcategories, units, products, pack configs
│   │   ├── pricing/            # Multi-tier pricing matrix & authoritative cart resolver
│   │   ├── sales/              # Atomic POS checkout, sequential bill numbering, thermal receipt
│   │   ├── returns/            # Sales return validation, eligible quantity, restock
│   │   ├── production/         # Kitchen batch entries & stock inward
│   │   ├── inventory/          # Stock balances, movement ledger, and reconciliation audit
│   │   └── settings/           # Company info, invoice prefix, thermal printer format
│   └── database/
│       ├── prisma/
│       │   ├── schema.prisma   # Declarative database schema
│       │   └── migrations/     # Versioned SQL migrations
│       └── seed.ts             # Development foundation seed
├── tests/
│   ├── step2-foundation.test.ts # Step 2 foundation tests
│   └── verify-all.ts           # Business flow integration tests
├── .env.example
├── tsconfig.json
└── package.json
```
