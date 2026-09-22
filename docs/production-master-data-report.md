# Vahanvati Gruh Udhyog — Production Master Data Export & Verification Report

**Document Version:** 1.0.0  
**Generated Date:** 2026-09-22  
**Target System:** Production Environment (`https://vahanvatigruhudhyog.com`)  
**SQL Artifact:** [`docs/production-master-data.sql`](./production-master-data.sql)  

---

## 1. Local Database Inspected

- **Database Management System:** PostgreSQL 16
- **Database Name:** `vahanvati_db`
- **Host / Port:** `localhost:5432` (Unix Socket: `/tmp:5432`)
- **Connection User:** `pinkalkachhia`
- **Prisma Schema Path:** `backend/src/database/prisma/schema.prisma`
- **Inspection Method:** Read-only Prisma Client queries + transactional dry-run with rollback.
- **Safety Status:** **100% UNTOUCHED** (No updates, inserts, deletes, truncations, or schema changes were performed).

---

## 2. Tables Included in Export

The export strictly isolates **Core Product & Brand Master Data**:

| # | Table Name | Description | Exported Records | Primary Key / Identity |
|---|---|---|---|---|
| 1 | `units` | Measurement units (Gram, Kilogram, Piece) | **3** | Fixed UUIDs (`00000000-0000-...-0001` to `0003`) |
| 2 | `categories` | Main product categories (Farsan, Sev, Vadi, Chakri, etc.) | **8** | UUID |
| 3 | `subcategories` | Product subcategories linked to parent categories | **8** | UUID |
| 4 | `products` | Real handcrafted products with Gujarati names & codes | **53** | UUID |
| 5 | `product_pack_configurations` | Pre-packaged unit configurations (e.g. 500g, 250g) | **14** | UUID |
| 6 | `product_prices` | Base rates & pack rates for INDIAN and NRI customer types | **122** | UUID |
| 7 | `company_settings` | Authentic Padgol kitchen address, GSTIN, FSSAI, Maps URL | **1** | UUID |
| 8 | `website_contents` | Official public CMS content (Story, Values, Announcement) | **3** | UUID |
| 9 | `gallery_items` | Approved YouTube videos & artisanal photos | **3** | UUID |
| **TOTAL** | | | **215** | |

---

## 3. Tables Intentionally Excluded

To protect production integrity and prevent development artifacts, test logs, or mock transactions from leaking, the following tables are **explicitly excluded**:

| Excluded Table | Reason for Exclusion | Local Records Ignored |
|---|---|---|
| `users` | User credentials must not be overwritten or hardcoded in SQL exports. (Production has its own admin/outlet users). | 3 |
| `refresh_tokens` | Ephemeral user login sessions. | 303 |
| `customers` | Test and development walk-in customer entries. | 7 |
| `sales` | Development counter and POS test sales transactions. | 47 |
| `sale_items` | Line items belonging to test transactions. | 49 |
| `payments` | Test payment records. | 47 |
| `sales_returns` | Development sales return test cases. | 17 |
| `sales_return_items` | Sales return line items from test cases. | 17 |
| `production_entries` | Development kitchen batch logs. | 10 |
| `stocks` | Dynamic inventory balances. (Stock records are automatically generated/reconciled upon production receipt or opening inventory count). | 53 |
| `stock_movements` | Immutable inventory ledger from development tests. | 130 |
| `audit_logs` | Historical development audit trail entries. | 124 |

---

## 4. Foreign-Key Dependency Order

To guarantee that no foreign key constraint errors can occur upon insertion, the SQL export strictly executes in hierarchical dependency order:

```
Level 1: units (Independent measurement units)
Level 1: categories (Independent top-level categories)
   ↓
Level 2: subcategories (References categories.id)
   ↓
Level 3: products (References subcategories.id & units.id)
   ↓
Level 4: product_pack_configurations (References products.id & units.id)
   ↓
Level 5: product_prices (References products.id & product_pack_configurations.id)
   ↓
Auxiliary: company_settings (Independent brand metadata)
Auxiliary: website_contents (Independent public section JSON content)
Auxiliary: gallery_items (Independent media showcase)
```

---

## 5. Master Data Metric Summary

- **Total Categories:** `8`
  - `CAT_REG_PAPDI` (રેગ્યુલર પાપડી)
  - `FARSAN` (Farsan)
  - `CAT_SEV` (સેવ)
  - `CAT_VADI` (વડી)
  - `CAT_CHAKRI` (ચકરી)
  - `CAT_MATHIYA_PAPAD` (મઠીયા - પાપડ)
  - `CAT_FARALI` (ફરાળી આઈટમ)
  - `CAT_MASALA` (મસાલા)
- **Total Subcategories:** `8` (100% matched 1:1 to parent categories)
- **Total Units:** `3` (`gm`, `kg`, `pc`)
- **Total Products:** `53`
  - Website Visible Products: `53` (100%)
  - Featured Products: `8` (Chorafali, Mathiya, Kadhi Masalo, Kodri Papdi, Sev, Ghaunni Papdi, Cha Masalo, Chokhani Chakri)
  - Loose Weight Allowed: `53` (100%)
- **Total Product Pack Configurations:** `14`
- **Total Product Prices:** `122`
  - Loose Weight Product Prices: `106` (53 products × 2 customer tiers: `INDIAN` and `NRI`)
  - Pack Configuration Prices: `16`
  - Prices referencing `users`: `0` (`created_by` is `NULL` for all rows)

---

## 6. Potential Conflicts & Resolution Strategy

1. **Pre-existing Standard Units in Production:**
   - *Risk:* If the production database was initialized via seed, `units` may already contain Gram (`...0001`), Kilogram (`...0002`), and Piece (`...0003`).
   - *Resolution:* All INSERT statements utilize `ON CONFLICT ("id") DO UPDATE SET ...`, making the script **idempotent**. If the unit already exists, it is gracefully updated without failing.
2. **Company Settings Uniqueness:**
   - *Risk:* A default company setting row may already exist.
   - *Resolution:* `company_settings` uses `ON CONFLICT ("id") DO UPDATE`, ensuring the official Padgol address, GSTIN (`24BCIPP6428E1ZL`), and FSSAI license (`20720004000511`) are accurately synced.
3. **Foreign Key to Users:**
   - *Risk:* If `product_prices.created_by` or `website_contents.updated_by` referenced local user UUIDs that do not exist in production, foreign key constraints would fail.
   - *Resolution:* `product_prices.created_by` is confirmed `NULL` across all 122 rows. `website_contents` uses section-level upsert without requiring foreign user constraints.
4. **Non-Destructive Operations:**
   - *Verification:* The export contains **NO** `DROP TABLE`, `TRUNCATE`, `DELETE`, `ALTER TABLE`, or schema altering DDL.

---

## 7. Automated Validation Results

A two-stage automated validation was conducted prior to finalization:

### Stage 1: Relational Integrity Analysis
- Subcategory orphan count: **0**
- Product subcategory orphan count: **0**
- Product primary unit orphan count: **0**
- Duplicate product codes: **0**
- Pack configuration orphan count: **0**
- Price product orphan count: **0**
- Price pack configuration orphan count: **0**

### Stage 2: Transactional Dry-Run Against Live Engine
- Total parsed SQL statements: **215**
- Statements executed successfully: **215 / 215 (100%)**
- PostgreSQL transaction: **ROLLED BACK**
- Net database state change: **0 rows modified**

---

## 8. Exact Commands for Production Import (For Later Execution)

> [!WARNING]
> **DO NOT EXECUTE THESE COMMANDS YET.**  
> Execution must occur ONLY after receiving explicit confirmation and approval.

When approved, the import can be executed using any of the following standard methods:

### Method A: Via Docker on KVM 2 Server (Recommended)
Copy `docs/production-master-data.sql` to the server, then pipe into the production database container:

```bash
# 1. Transfer SQL file to KVM 2 server
scp docs/production-master-data.sql user@vahanvatigruhudhyog.com:/root/production-master-data.sql

# 2. Execute within the running PostgreSQL container
docker exec -i vahanvati-db psql -U vahanvati_user -d vahanvati_production < /root/production-master-data.sql
```

### Method B: Via Remote psql Connection
```bash
psql "postgresql://<PROD_USER>:<PROD_PASSWORD>@<PROD_HOST>:5432/<PROD_DB>?sslmode=require" -f docs/production-master-data.sql
```

### Method C: Verification Query in Production Post-Import
```sql
SELECT 'categories' AS table_name, COUNT(*) FROM categories
UNION ALL
SELECT 'subcategories', COUNT(*) FROM subcategories
UNION ALL
SELECT 'units', COUNT(*) FROM units
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'product_pack_configurations', COUNT(*) FROM product_pack_configurations
UNION ALL
SELECT 'product_prices', COUNT(*) FROM product_prices;
```
*Expected Count: 8 categories, 8 subcategories, 3 units, 53 products, 14 pack configs, 122 product prices.*
