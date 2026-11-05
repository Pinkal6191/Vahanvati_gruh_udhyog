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

# Pre-scan SQL file for dangerous destructive operations
if grep -Ei '\b(DROP\s+DATABASE|DROP\s+TABLE|TRUNCATE\s+sales|DELETE\s+FROM\s+sales|TRUNCATE\s+users|DELETE\s+FROM\s+users)\b' "$SQL_FILE" >/dev/null 2>&1; then
  echo "❌ CRITICAL STOP: $SQL_FILE contains forbidden destructive operations (DROP/TRUNCATE sales/users)!"
  exit 1
fi

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

export PGHOST="localhost"
export PGPORT="5432"
export PGUSER="vahanvati_user"
export PGDATABASE="vahanvati_db"
export PGPASSWORD=""

if [ -n "$ENV_FILE" ]; then
  echo "📁 Detected backend environment file: $ENV_FILE"
  RAW_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n 1 | cut -d '=' -f2- | sed -e 's/^["'\'' ]*//' -e 's/["'\'' ]*$//')
  
  if [ -n "${RAW_URL:-}" ]; then
    if command -v node >/dev/null 2>&1; then
      while IFS='=' read -r key val; do
        case "$key" in
          PGHOST) export PGHOST="$val" ;;
          PGPORT) export PGPORT="$val" ;;
          PGUSER) export PGUSER="$val" ;;
          PGDATABASE) export PGDATABASE="$val" ;;
          PGPASSWORD) export PGPASSWORD="$val" ;;
        esac
      done < <(node -e '
        const url = process.argv[1];
        if (!url) process.exit(1);
        const prefixMatch = url.match(/^(?:postgresql|postgres):\/\/([^:]+):/);
        if (!prefixMatch) process.exit(1);
        const user = prefixMatch[1];
        const rest = url.slice(prefixMatch[0].length);
        let atIdx = rest.lastIndexOf("@localhost");
        if (atIdx === -1) atIdx = rest.lastIndexOf("@127.0.0.1");
        if (atIdx === -1) atIdx = rest.lastIndexOf("@");
        if (atIdx === -1) process.exit(1);
        let pass = rest.slice(0, atIdx);
        if (pass.includes("%")) {
          try { pass = decodeURIComponent(pass); } catch(e){}
        }
        const hostAndRest = rest.slice(atIdx + 1);
        const hostMatch = hostAndRest.match(/^([^:/]+)(?::(\d+))?\/([^?]+)/);
        if (!hostMatch) process.exit(1);
        const host = hostMatch[1];
        const port = hostMatch[2] || "5432";
        const db = hostMatch[3];
        console.log(`PGHOST=${host}`);
        console.log(`PGPORT=${port}`);
        console.log(`PGUSER=${user}`);
        console.log(`PGDATABASE=${db}`);
        console.log(`PGPASSWORD=${pass}`);
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
      export PGPASSWORD
    fi
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

# 3. Create Backup Directory & Disk Check
mkdir -p "$BACKUP_DIR" 2>/dev/null || true
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

MIN_REQUIRED_MB=500
AVAILABLE_MB=$(df -m "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
if [ -n "$AVAILABLE_MB" ] && [ "$AVAILABLE_MB" -ne 0 ] 2>/dev/null; then
  if [ "$AVAILABLE_MB" -lt "$MIN_REQUIRED_MB" ]; then
    echo "❌ CRITICAL STOP: Insufficient free disk space in ${BACKUP_DIR}! Required: ${MIN_REQUIRED_MB}MB, Available: ${AVAILABLE_MB}MB."
    exit 1
  fi
fi

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
if [ -e "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup destination $BACKUP_FILE already exists. Refusing to overwrite!"
  exit 1
fi

(
  umask 077
  pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" > "$BACKUP_FILE"
)
chmod 600 "$BACKUP_FILE" 2>/dev/null || true

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  if ! head -n 30 "$BACKUP_FILE" | grep -qi "PostgreSQL database dump"; then
    echo "❌ CRITICAL STOP: Backup header verification failed! Invalid dump file."
    exit 1
  fi
  if ! tail -n 30 "$BACKUP_FILE" | grep -qi "PostgreSQL database dump complete"; then
    echo "❌ CRITICAL STOP: Backup footer verification failed! Incomplete or truncated dump."
    exit 1
  fi
  if ! grep -q "CREATE TABLE" "$BACKUP_FILE"; then
    echo "❌ CRITICAL STOP: Backup structural verification failed! No table definitions found."
    exit 1
  fi
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | awk '{print $1}' || echo "unknown")
  echo "✅ Production backup created and verified successfully!"
  echo "   Path: $BACKUP_FILE"
  echo "   Size: $BACKUP_SIZE"
  echo "   Permissions: 0600 (owner-only)"
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

ORPHAN_COUNT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -A -c "
SELECT COALESCE(SUM(cnt), 0) FROM (
  SELECT COUNT(*) AS cnt FROM subcategories s WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = s.category_id)
  UNION ALL SELECT COUNT(*) FROM products p WHERE NOT EXISTS (SELECT 1 FROM subcategories s WHERE s.id = p.subcategory_id)
  UNION ALL SELECT COUNT(*) FROM products p WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.id = p.primary_unit_id)
  UNION ALL SELECT COUNT(*) FROM product_pack_configurations pc WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pc.product_id)
  UNION ALL SELECT COUNT(*) FROM product_prices pr WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pr.product_id)
) t;
" 2>/dev/null || echo "0")

if [ "$ORPHAN_COUNT" -gt 0 ] 2>/dev/null; then
  echo "⚠️ WARNING: Detected $ORPHAN_COUNT foreign key orphan rows after import! Review table above."
else
  echo "✅ Zero foreign key orphans detected. Referential integrity verified!"
fi

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
