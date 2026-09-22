#!/usr/bin/env bash
# ====================================================================
# Vahanvati Gruh Udhyog — Production Master Data Import & Verification Script
# ====================================================================
set -euo pipefail

echo "=================================================="
echo "VAHANVATI GRUH UDHYOG — PRODUCTION MASTER DATA IMPORT"
echo "=================================================="

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
BACKUP_FILE="${BACKUP_DIR}/vahanvati_pre_master_import_${TIMESTAMP}.sql"
SQL_FILE="production-master-data.sql"

# 1. Locate SQL file
if [ ! -f "$SQL_FILE" ]; then
  if [ -f "/root/$SQL_FILE" ]; then
    SQL_FILE="/root/$SQL_FILE"
  elif [ -f "docs/$SQL_FILE" ]; then
    SQL_FILE="docs/$SQL_FILE"
  else
    echo "❌ Error: $SQL_FILE not found in current directory or /root/."
    exit 1
  fi
fi

echo "📁 Using master data SQL file: $SQL_FILE"

# 2. Extract database connection parameters safely from .env
ENV_FILE=""
for candidate in \
  "/var/www/html/vahanvati-gruh-udhyog/backend/.env" \
  "backend/.env" \
  ".env" \
  "/var/www/vahanvati/backend/.env" \
  "/root/Vahanvati_gruh_udhyog/backend/.env"; do
  if [ -f "$candidate" ]; then
    ENV_FILE="$candidate"
    break
  fi
done

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-vahanvati_user}"
export PGDATABASE="${PGDATABASE:-vahanvati_db}"

if [ -n "$ENV_FILE" ]; then
  echo "📁 Detected backend environment file: $ENV_FILE"
  RAW_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n 1 | cut -d '=' -f2- | sed -e 's/^["'\'' ]*//' -e 's/["'\'' ]*$//')
  
  # Extract password using node if available, with bash fallback
  if [ -n "${RAW_URL:-}" ]; then
    if command -v node >/dev/null 2>&1; then
      PGPASSWORD=$(node -e '
        const url = process.argv[1];
        const prefixMatch = url.match(/^(?:postgresql|postgres):\/\/[^:]+:/);
        if (!prefixMatch) process.exit(1);
        const rest = url.slice(prefixMatch[0].length);
        let idx = rest.lastIndexOf("@localhost");
        if (idx === -1) idx = rest.lastIndexOf("@127.0.0.1");
        if (idx === -1) idx = rest.lastIndexOf("@");
        if (idx === -1) process.exit(1);
        process.stdout.write(rest.slice(0, idx));
      ' "$RAW_URL" 2>/dev/null || true)
    fi
    
    # Pure bash fallback if node was not used or failed
    if [ -z "${PGPASSWORD:-}" ]; then
      no_proto="${RAW_URL#*://}"
      pass_and_rest="${no_proto#*:}"
      PGPASSWORD="${pass_and_rest%@localhost*}"
      if [[ "$PGPASSWORD" == *"@127.0.0.1"* ]]; then
        PGPASSWORD="${PGPASSWORD%@127.0.0.1*}"
      fi
    fi
    export PGPASSWORD
  fi
fi

if [ -z "${PGPASSWORD:-}" ]; then
  echo "⚠️ Password could not be automatically extracted from environment."
  read -sp "Enter PostgreSQL password for user $PGUSER: " PGPASSWORD
  echo ""
  export PGPASSWORD
fi

echo "🔌 Target Database: $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"

# Optional READ-ONLY test connection mode
if [ "${1:-}" = "--test-connection" ]; then
  echo ""
  echo "--------------------------------------------------"
  echo "READ-ONLY CONNECTION TEST"
  echo "--------------------------------------------------"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT current_database(), current_user, inet_server_addr(), version();"
  echo ""
  echo "✅ READ-ONLY connection test SUCCESSFUL! No data modified."
  exit 0
fi

# 3. Create Backup Directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "--------------------------------------------------"
echo "STEP 1: Checking Pre-Import Record Counts"
echo "--------------------------------------------------"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
SELECT 'categories' AS table_name, COUNT(*) FROM categories
UNION ALL SELECT 'subcategories', COUNT(*) FROM subcategories
UNION ALL SELECT 'units', COUNT(*) FROM units
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_pack_configurations', COUNT(*) FROM product_pack_configurations
UNION ALL SELECT 'product_prices', COUNT(*) FROM product_prices
UNION ALL SELECT 'company_settings', COUNT(*) FROM company_settings
UNION ALL SELECT 'website_contents', COUNT(*) FROM website_contents
UNION ALL SELECT 'gallery_items', COUNT(*) FROM gallery_items;
"

echo ""
echo "--------------------------------------------------"
echo "STEP 2: Creating Pre-Import PostgreSQL Backup"
echo "--------------------------------------------------"
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
  echo "✅ Production backup created successfully!"
  echo "   Path: $BACKUP_FILE"
  echo "   Size: $BACKUP_SIZE"
else
  echo "❌ Backup failed or produced empty file! ABORTING IMPORT."
  exit 1
fi

echo ""
echo "--------------------------------------------------"
echo "STEP 3: Executing Master Data Import"
echo "--------------------------------------------------"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --single-transaction --set ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "✅ Master data SQL successfully imported into production!"

echo ""
echo "--------------------------------------------------"
echo "STEP 4: Post-Import Production Counts Verification"
echo "--------------------------------------------------"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
SELECT 'categories' AS table_name, COUNT(*) FROM categories
UNION ALL SELECT 'subcategories', COUNT(*) FROM subcategories
UNION ALL SELECT 'units', COUNT(*) FROM units
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_pack_configurations', COUNT(*) FROM product_pack_configurations
UNION ALL SELECT 'product_prices', COUNT(*) FROM product_prices
UNION ALL SELECT 'company_settings', COUNT(*) FROM company_settings
UNION ALL SELECT 'website_contents', COUNT(*) FROM website_contents
UNION ALL SELECT 'gallery_items', COUNT(*) FROM gallery_items;
"

echo ""
echo "--------------------------------------------------"
echo "STEP 5: Foreign-Key Orphan Verification"
echo "--------------------------------------------------"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
SELECT 'subcat -> cat orphans' AS check, COUNT(*) FROM subcategories s WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = s.category_id)
UNION ALL
SELECT 'prod -> subcat orphans', COUNT(*) FROM products p WHERE NOT EXISTS (SELECT 1 FROM subcategories s WHERE s.id = p.subcategory_id)
UNION ALL
SELECT 'prod -> unit orphans', COUNT(*) FROM products p WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.id = p.primary_unit_id)
UNION ALL
SELECT 'pack -> prod orphans', COUNT(*) FROM product_pack_configurations pc WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pc.product_id)
UNION ALL
SELECT 'price -> prod orphans', COUNT(*) FROM product_prices pr WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pr.product_id);
"

echo ""
echo "--------------------------------------------------"
echo "STEP 6: Product Visibility Verification"
echo "--------------------------------------------------"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
SELECT
  COUNT(*) AS total_products,
  COUNT(*) FILTER (WHERE is_website_visible = true) AS website_visible,
  COUNT(*) FILTER (WHERE is_active = true) AS active_products,
  COUNT(*) FILTER (WHERE is_featured = true) AS featured_products
FROM products;
"

echo ""
echo "=================================================="
echo "🎉 PRODUCTION MASTER DATA IMPORT COMPLETED!"
echo "=================================================="
