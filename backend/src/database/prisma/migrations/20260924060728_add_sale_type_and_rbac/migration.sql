-- ==============================================================================
-- Migration: 20260924060728_add_sale_type_and_rbac
-- Description: In-place migration adding canonical SaleType, pricing_tier, snapshots,
--              and RBAC with zero-loss mathematical verification.
-- ==============================================================================

-- 0. Required Cryptographic Extension for Universal SHA-256 Digest
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create Transaction-Local Temporary Baseline Table
CREATE TEMP TABLE _migration_baseline (
    metric_key   VARCHAR(50) PRIMARY KEY,
    count_1      BIGINT,
    count_2      BIGINT,
    sum_1        NUMERIC(14,2),
    sum_2        NUMERIC(14,2),
    sum_3        NUMERIC(14,2),
    text_1       TEXT,
    uuid_1       UUID
) ON COMMIT DROP;

-- 2. Capture Pre-Migration Baselines into Temporary Table
-- 2.1 Global Sales Baseline (All rows in sales table)
INSERT INTO _migration_baseline (metric_key, count_1, count_2, sum_1, sum_2, sum_3)
SELECT 
    'GLOBAL_SALES',
    COUNT(*)::bigint,
    (SELECT COUNT(*) FROM "sale_items")::bigint,
    COALESCE(SUM("subtotal_amount"), 0)::numeric(14,2),
    COALESCE(SUM("tax_amount"), 0)::numeric(14,2),
    COALESCE(SUM("final_total_amount"), 0)::numeric(14,2)
FROM "sales";

-- 2.2 Stock Movements for Sales
INSERT INTO _migration_baseline (metric_key, count_1)
SELECT 'STOCK_MOVES', COUNT(*)::bigint
FROM "stock_movements" WHERE "movement_type" = 'SALE_OUT';

-- 2.3 ProductPrice Row Count and Deterministic SHA-256 Fingerprint (9 fields, sorted by id)
INSERT INTO _migration_baseline (metric_key, count_1, text_1)
SELECT 
    'PRICE_FINGERPRINT',
    COUNT(*)::bigint,
    encode(digest(string_agg(
        "id"::text || '|' ||
        "product_id"::text || '|' ||
        COALESCE("pack_config_id"::text, 'NULL') || '|' ||
        to_char("rate", 'FM999999990.00') || '|' ||
        to_char("effective_from" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
        COALESCE(to_char("effective_to" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'NULL') || '|' ||
        COALESCE("created_by"::text, 'NULL') || '|' ||
        to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
        to_char("updated_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        chr(10) ORDER BY "id"
    )::bytea, 'sha256'), 'hex')
FROM "product_prices";

-- 2.4 Grouped Historical INDIAN Sales
INSERT INTO _migration_baseline (metric_key, count_1, sum_1, sum_2, sum_3)
SELECT 
    'GROUP_INDIAN',
    COUNT(*)::bigint,
    COALESCE(SUM("subtotal_amount"), 0)::numeric(14,2),
    COALESCE(SUM("tax_amount"), 0)::numeric(14,2),
    COALESCE(SUM("final_total_amount"), 0)::numeric(14,2)
FROM "sales"
WHERE "customer_type_snapshot" = 'INDIAN';

-- 2.5 Grouped Historical NRI Sales
INSERT INTO _migration_baseline (metric_key, count_1, sum_1, sum_2, sum_3)
SELECT 
    'GROUP_NRI',
    COUNT(*)::bigint,
    COALESCE(SUM("subtotal_amount"), 0)::numeric(14,2),
    COALESCE(SUM("tax_amount"), 0)::numeric(14,2),
    COALESCE(SUM("final_total_amount"), 0)::numeric(14,2)
FROM "sales"
WHERE "customer_type_snapshot" = 'NRI';

-- 2.6 Historical Wholesale Check
INSERT INTO _migration_baseline (metric_key, count_1)
SELECT 'GROUP_WHOLESALE', COUNT(*)::bigint
FROM "sales"
WHERE "customer_type_snapshot"::text = 'WHOLESALE';

-- 2.7 Master Admin Candidate Verification
INSERT INTO _migration_baseline (metric_key, count_1, uuid_1)
SELECT 'MASTER_ADMIN_CANDIDATE', COUNT(*)::bigint, (SELECT "id" FROM "users" WHERE "role" = 'ADMIN' AND "is_active" = TRUE LIMIT 1)
FROM "users"
WHERE "role" = 'ADMIN' AND "is_active" = TRUE;

-- 3. Execute Schema Alterations and In-Place Data Transformations
-- 3.1 Create Canonical SaleType Enum
CREATE TYPE "SaleType" AS ENUM ('RETAIL', 'NRI', 'WHOLESALE');

-- 3.2 Transform product_prices In-Place
ALTER TABLE "product_prices" ADD COLUMN "pricing_tier" "SaleType";

UPDATE "product_prices"
SET "pricing_tier" = CASE
    WHEN "customer_type"::text = 'INDIAN' THEN 'RETAIL'::"SaleType"
    WHEN "customer_type"::text = 'NRI' THEN 'NRI'::"SaleType"
    ELSE 'RETAIL'::"SaleType"
END;

ALTER TABLE "product_prices" ALTER COLUMN "pricing_tier" SET NOT NULL;
ALTER TABLE "product_prices" ALTER COLUMN "pricing_tier" SET DEFAULT 'RETAIL'::"SaleType";

DROP INDEX IF EXISTS "product_prices_product_id_customer_type_effective_from_idx";
CREATE INDEX "product_prices_product_id_pricing_tier_effective_from_idx" 
ON "product_prices"("product_id", "pricing_tier", "effective_from");

ALTER TABLE "product_prices" DROP COLUMN "customer_type";

-- 3.3 Transform sales
ALTER TABLE "sales" ADD COLUMN "sale_type" "SaleType" NOT NULL DEFAULT 'RETAIL';
ALTER TABLE "sales" ADD COLUMN "customer_gstin_snapshot" VARCHAR(50);

UPDATE "sales"
SET "sale_type" = 'NRI'::"SaleType"
WHERE "customer_type_snapshot"::text = 'NRI';

CREATE INDEX "sales_sale_type_created_at_idx" ON "sales"("sale_type", "created_at");

-- 3.4 Transform sale_items
ALTER TABLE "sale_items" ADD COLUMN "sale_type_snapshot" "SaleType" NOT NULL DEFAULT 'RETAIL';

UPDATE "sale_items" si
SET "sale_type_snapshot" = s."sale_type"
FROM "sales" s
WHERE si."sale_id" = s."id";

-- 3.5 Transform sales_returns
ALTER TABLE "sales_returns" ADD COLUMN "sale_type_snapshot" "SaleType" NOT NULL DEFAULT 'RETAIL';

UPDATE "sales_returns" sr
SET "sale_type_snapshot" = s."sale_type"
FROM "sales" s
WHERE sr."original_sale_id" = s."id";

-- 3.6 Transform users (RBAC & Privileges)
ALTER TABLE "users" ADD COLUMN "is_master_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "allowed_billing_sale_types" "SaleType"[] NOT NULL DEFAULT ARRAY['RETAIL', 'NRI']::"SaleType"[];
ALTER TABLE "users" ADD COLUMN "allowed_report_sale_types" "SaleType"[] NOT NULL DEFAULT ARRAY['RETAIL', 'NRI']::"SaleType"[];

-- Set Master Admin to the approved UUID
UPDATE "users"
SET 
    "is_master_admin" = true,
    "allowed_billing_sale_types" = ARRAY['RETAIL', 'NRI', 'WHOLESALE']::"SaleType"[],
    "allowed_report_sale_types" = ARRAY['RETAIL', 'NRI', 'WHOLESALE']::"SaleType"[]
WHERE "id" = '7dd3911f-0d81-4809-8e30-f4572df32add';

-- Strictly enforce non-master access for all other accounts
UPDATE "users"
SET 
    "is_master_admin" = false,
    "allowed_billing_sale_types" = ARRAY['RETAIL', 'NRI']::"SaleType"[],
    "allowed_report_sale_types" = ARRAY['RETAIL', 'NRI']::"SaleType"[]
WHERE "id" != '7dd3911f-0d81-4809-8e30-f4572df32add';

-- 4. In-Transaction Verification & Assertion Engine (PL/pgSQL)
DO $$
DECLARE
    -- Baseline variables
    v_pre_sales_count BIGINT;
    v_pre_items_count BIGINT;
    v_pre_subtotal_sum NUMERIC(14,2);
    v_pre_tax_sum NUMERIC(14,2);
    v_pre_total_sum NUMERIC(14,2);
    v_pre_stock_moves_count BIGINT;
    v_pre_price_count BIGINT;
    v_pre_price_hash TEXT;
    v_pre_admin_count BIGINT;
    v_pre_admin_id UUID;
    v_pre_indian_count BIGINT;
    v_pre_indian_subtotal NUMERIC(14,2);
    v_pre_indian_tax NUMERIC(14,2);
    v_pre_indian_total NUMERIC(14,2);
    v_pre_nri_count BIGINT;
    v_pre_nri_subtotal NUMERIC(14,2);
    v_pre_nri_tax NUMERIC(14,2);
    v_pre_nri_total NUMERIC(14,2);
    v_pre_wholesale_count BIGINT;

    -- Live Post-Migration variables
    v_post_sales_count BIGINT;
    v_post_items_count BIGINT;
    v_post_subtotal_sum NUMERIC(14,2);
    v_post_tax_sum NUMERIC(14,2);
    v_post_total_sum NUMERIC(14,2);
    v_post_stock_moves_count BIGINT;
    v_post_price_count BIGINT;
    v_post_price_hash TEXT;
    v_post_master_admin_count INT;
    v_post_master_admin_id UUID;
    v_post_unauthorized_master_count INT;
    v_post_retail_count BIGINT;
    v_post_retail_subtotal NUMERIC(14,2);
    v_post_retail_tax NUMERIC(14,2);
    v_post_retail_total NUMERIC(14,2);
    v_post_nri_count BIGINT;
    v_post_nri_subtotal NUMERIC(14,2);
    v_post_nri_tax NUMERIC(14,2);
    v_post_nri_total NUMERIC(14,2);
    v_post_wholesale_count BIGINT;
BEGIN
    -- 4.1 Load Pre-Migration Baselines
    SELECT count_1, count_2, sum_1, sum_2, sum_3 
    INTO v_pre_sales_count, v_pre_items_count, v_pre_subtotal_sum, v_pre_tax_sum, v_pre_total_sum
    FROM _migration_baseline WHERE metric_key = 'GLOBAL_SALES';

    SELECT count_1 INTO v_pre_stock_moves_count 
    FROM _migration_baseline WHERE metric_key = 'STOCK_MOVES';

    SELECT count_1, text_1 INTO v_pre_price_count, v_pre_price_hash
    FROM _migration_baseline WHERE metric_key = 'PRICE_FINGERPRINT';

    SELECT count_1, uuid_1 INTO v_pre_admin_count, v_pre_admin_id
    FROM _migration_baseline WHERE metric_key = 'MASTER_ADMIN_CANDIDATE';

    SELECT count_1, sum_1, sum_2, sum_3
    INTO v_pre_indian_count, v_pre_indian_subtotal, v_pre_indian_tax, v_pre_indian_total
    FROM _migration_baseline WHERE metric_key = 'GROUP_INDIAN';

    SELECT count_1, sum_1, sum_2, sum_3
    INTO v_pre_nri_count, v_pre_nri_subtotal, v_pre_nri_tax, v_pre_nri_total
    FROM _migration_baseline WHERE metric_key = 'GROUP_NRI';

    SELECT count_1 INTO v_pre_wholesale_count
    FROM _migration_baseline WHERE metric_key = 'GROUP_WHOLESALE';

    -- 4.2 Query Live Post-Migration Metrics
    SELECT COUNT(*), COALESCE(SUM("subtotal_amount"), 0), COALESCE(SUM("tax_amount"), 0), COALESCE(SUM("final_total_amount"), 0)
    INTO v_post_sales_count, v_post_subtotal_sum, v_post_tax_sum, v_post_total_sum
    FROM "sales";

    SELECT COUNT(*) INTO v_post_items_count FROM "sale_items";
    SELECT COUNT(*) INTO v_post_stock_moves_count FROM "stock_movements" WHERE "movement_type" = 'SALE_OUT';

    SELECT COUNT(*), encode(digest(string_agg(
        "id"::text || '|' || "product_id"::text || '|' || COALESCE("pack_config_id"::text, 'NULL') || '|' ||
        to_char("rate", 'FM999999990.00') || '|' ||
        to_char("effective_from" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
        COALESCE(to_char("effective_to" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'NULL') || '|' ||
        COALESCE("created_by"::text, 'NULL') || '|' ||
        to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
        to_char("updated_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        chr(10) ORDER BY "id"
    )::bytea, 'sha256'), 'hex')
    INTO v_post_price_count, v_post_price_hash
    FROM "product_prices";

    SELECT COUNT(*) INTO v_post_master_admin_count FROM "users" WHERE "is_master_admin" = TRUE;
    SELECT "id" INTO v_post_master_admin_id FROM "users" WHERE "is_master_admin" = TRUE LIMIT 1;
    SELECT COUNT(*) INTO v_post_unauthorized_master_count FROM "users" WHERE "id" != '7dd3911f-0d81-4809-8e30-f4572df32add'::uuid AND "is_master_admin" = TRUE;

    SELECT COUNT(*), COALESCE(SUM("subtotal_amount"), 0), COALESCE(SUM("tax_amount"), 0), COALESCE(SUM("final_total_amount"), 0)
    INTO v_post_retail_count, v_post_retail_subtotal, v_post_retail_tax, v_post_retail_total
    FROM "sales" WHERE "sale_type" = 'RETAIL';

    SELECT COUNT(*), COALESCE(SUM("subtotal_amount"), 0), COALESCE(SUM("tax_amount"), 0), COALESCE(SUM("final_total_amount"), 0)
    INTO v_post_nri_count, v_post_nri_subtotal, v_post_nri_tax, v_post_nri_total
    FROM "sales" WHERE "sale_type" = 'NRI';

    SELECT COUNT(*) INTO v_post_wholesale_count
    FROM "sales" WHERE "sale_type" = 'WHOLESALE';

    -- 4.3 Evaluate Master Admin Safety Pre-Conditions
    IF v_pre_admin_count != 1 THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Expected exactly 1 active ADMIN candidate before migration, found %', v_pre_admin_count;
    END IF;

    IF v_pre_admin_id != '7dd3911f-0d81-4809-8e30-f4572df32add'::uuid THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Active ADMIN candidate UUID (%) does not match approved Master Admin UUID (7dd3911f-0d81-4809-8e30-f4572df32add)', v_pre_admin_id;
    END IF;

    -- 4.4 Evaluate Post-Migration Master Admin Assertions
    IF v_post_master_admin_count != 1 THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Expected exactly 1 Master Admin after migration, found %', v_post_master_admin_count;
    END IF;

    IF v_post_master_admin_id != '7dd3911f-0d81-4809-8e30-f4572df32add'::uuid THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Master Admin UUID (%) does not match approved UUID (7dd3911f-0d81-4809-8e30-f4572df32add)', v_post_master_admin_id;
    END IF;

    IF v_post_unauthorized_master_count != 0 THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Found % unauthorized users with is_master_admin = TRUE', v_post_unauthorized_master_count;
    END IF;

    -- 4.5 Evaluate Global 6 Metrics Exact Equality
    IF v_post_sales_count != v_pre_sales_count THEN
        RAISE EXCEPTION 'MIGRATION FAILED: sales count mismatch (Pre: %, Post: %)', v_pre_sales_count, v_post_sales_count;
    END IF;

    IF v_post_items_count != v_pre_items_count THEN
        RAISE EXCEPTION 'MIGRATION FAILED: sale_items count mismatch (Pre: %, Post: %)', v_pre_items_count, v_post_items_count;
    END IF;

    IF v_post_stock_moves_count != v_pre_stock_moves_count THEN
        RAISE EXCEPTION 'MIGRATION FAILED: sale stock moves count mismatch (Pre: %, Post: %)', v_pre_stock_moves_count, v_post_stock_moves_count;
    END IF;

    IF v_post_subtotal_sum != v_pre_subtotal_sum THEN
        RAISE EXCEPTION 'MIGRATION FAILED: subtotal sum mismatch (Pre: %, Post: %)', v_pre_subtotal_sum, v_post_subtotal_sum;
    END IF;

    IF v_post_tax_sum != v_pre_tax_sum THEN
        RAISE EXCEPTION 'MIGRATION FAILED: tax sum mismatch (Pre: %, Post: %)', v_pre_tax_sum, v_post_tax_sum;
    END IF;

    IF v_post_total_sum != v_pre_total_sum THEN
        RAISE EXCEPTION 'MIGRATION FAILED: final total sum mismatch (Pre: %, Post: %)', v_pre_total_sum, v_post_total_sum;
    END IF;

    -- 4.6 Evaluate ProductPrice Fingerprint and Count
    IF v_post_price_count != v_pre_price_count THEN
        RAISE EXCEPTION 'MIGRATION FAILED: product_prices count mismatch (Pre: %, Post: %)', v_pre_price_count, v_post_price_count;
    END IF;

    IF v_post_price_hash != v_pre_price_hash THEN
        RAISE EXCEPTION 'MIGRATION FAILED: product_prices SHA-256 fingerprint mismatch! Pre: % | Post: %', v_pre_price_hash, v_post_price_hash;
    END IF;

    -- 4.7 Evaluate INDIAN -> RETAIL Grouped Equality
    IF v_post_retail_count != v_pre_indian_count THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Retail count (%) != pre-Indian count (%)', v_post_retail_count, v_pre_indian_count;
    END IF;

    IF v_post_retail_subtotal != v_pre_indian_subtotal THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Retail subtotal (%) != pre-Indian subtotal (%)', v_post_retail_subtotal, v_pre_indian_subtotal;
    END IF;

    IF v_post_retail_tax != v_pre_indian_tax THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Retail tax (%) != pre-Indian tax (%)', v_post_retail_tax, v_pre_indian_tax;
    END IF;

    IF v_post_retail_total != v_pre_indian_total THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Retail total (%) != pre-Indian total (%)', v_post_retail_total, v_pre_indian_total;
    END IF;

    -- 4.8 Evaluate NRI -> NRI Grouped Equality
    IF v_post_nri_count != v_pre_nri_count THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Post-NRI count (%) != pre-NRI count (%)', v_post_nri_count, v_pre_nri_count;
    END IF;

    IF v_post_nri_subtotal != v_pre_nri_subtotal THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Post-NRI subtotal (%) != pre-NRI subtotal (%)', v_post_nri_subtotal, v_pre_nri_subtotal;
    END IF;

    IF v_post_nri_tax != v_pre_nri_tax THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Post-NRI tax (%) != pre-NRI tax (%)', v_post_nri_tax, v_pre_nri_tax;
    END IF;

    IF v_post_nri_total != v_pre_nri_total THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Post-NRI total (%) != pre-NRI total (%)', v_post_nri_total, v_pre_nri_total;
    END IF;

    -- 4.9 Evaluate Wholesale Historical Count
    IF v_pre_wholesale_count != 0 OR v_post_wholesale_count != 0 THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Wholesale historical sales must be 0 (Pre: %, Post: %)', v_pre_wholesale_count, v_post_wholesale_count;
    END IF;

    RAISE NOTICE 'SUCCESS: ALL IN-TRANSACTION MIGRATION ASSERTIONS PASSED WITH 0.00 VARIANCE.';
END $$;
