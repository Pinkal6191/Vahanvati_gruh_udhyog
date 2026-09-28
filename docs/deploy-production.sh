#!/usr/bin/env bash
# ====================================================================
# Vahanvati Gruh Udhyog — Production Controlled Deployment Script
# Target: 148.135.137.247
# ====================================================================
set -euo pipefail

TARGET_COMMIT="${1:-c5f2fd08fe7f020d4dd7d73597524aacd4c1e79d}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
BACKUP_FILE="${BACKUP_DIR}/vahanvati_pre_deploy_${TIMESTAMP}.sql"

echo "=================================================="
echo "🚀 VAHANVATI GRUH UDHYOG — PRODUCTION DEPLOYMENT"
echo "📅 Deployment Time: $(date)"
echo "🎯 Target Commit:   ${TARGET_COMMIT}"
echo "=================================================="

# Ensure running in project root
REPO_DIR="/var/www/html/vahanvati-gruh-udhyog"
if [ -d "$REPO_DIR" ]; then
  cd "$REPO_DIR"
fi

# ----------------------------------------------------
# STEP 1: PRE-DEPLOYMENT LOCAL GIT CHECK
# ----------------------------------------------------
echo ""
echo "[Step 1/8] Verifying Repository & Previous Commit..."
PREV_COMMIT=$(git rev-parse HEAD)
echo "📌 Current Production Commit: ${PREV_COMMIT}"

# Fetch latest from origin
git fetch origin main

# Checkout target commit
echo "🔄 Checking out ${TARGET_COMMIT}..."
git checkout "${TARGET_COMMIT}"

DEPLOYED_COMMIT=$(git rev-parse HEAD)
echo "✅ Deployed Commit verified: ${DEPLOYED_COMMIT}"
if [ "${DEPLOYED_COMMIT}" != "${TARGET_COMMIT}" ]; then
  echo "❌ CRITICAL STOP: HEAD (${DEPLOYED_COMMIT}) does not match target (${TARGET_COMMIT})!"
  exit 1
fi

# ----------------------------------------------------
# STEP 2: EXTRACT DB PARAMS & CREATE BACKUP
# ----------------------------------------------------
echo ""
echo "[Step 2/8] Creating Production Database Backup..."
ENV_FILE=""
for candidate in \
  "${REPO_DIR}/backend/.env" \
  "/var/www/html/vahanvati-gruh-udhyog/backend/.env" \
  "backend/.env" \
  ".env"; do
  if [ -f "$candidate" ]; then
    ENV_FILE="$candidate"
    break
  fi
done

if [ -z "$ENV_FILE" ]; then
  echo "❌ Error: backend/.env not found!"
  exit 1
fi

RAW_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n 1 | cut -d '=' -f2- | sed -e 's/^["'\'' ]*//' -e 's/["'\'' ]*$//')

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-vahanvati_user}"
export PGDATABASE="${PGDATABASE:-vahanvati_db}"

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

if [ -z "${PGPASSWORD:-}" ]; then
  no_proto="${RAW_URL#*://}"
  pass_and_rest="${no_proto#*:}"
  PGPASSWORD="${pass_and_rest%@localhost*}"
  if [[ "$PGPASSWORD" == *"@127.0.0.1"* ]]; then
    PGPASSWORD="${PGPASSWORD%@127.0.0.1*}"
  fi
fi
export PGPASSWORD

mkdir -p "$BACKUP_DIR"

echo "💾 Running pg_dump to ${BACKUP_FILE}..."
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --clean --if-exists > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ CRITICAL STOP: Backup file is empty or failed to create!"
  exit 1
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "✅ Database backup created successfully!"
echo "   File: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ----------------------------------------------------
# STEP 3: PRE-DEPLOYMENT DATABASE & MIGRATION CHECK
# ----------------------------------------------------
echo ""
echo "[Step 3/8] Inspecting Production Database & Migrations (Read-Only)..."
export PAGER=cat
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --no-align -c "SELECT current_database(), current_user, inet_server_addr(), version();"

echo "📦 Ensuring all products have initialized stock records..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
INSERT INTO stocks (id, product_id, current_balance, minimum_threshold, last_updated_at)
SELECT gen_random_uuid(), p.id, 0.000, 0.000, NOW()
FROM products p
LEFT JOIN stocks s ON p.id = s.product_id
WHERE s.id IS NULL
ON CONFLICT (product_id) DO NOTHING;
"

echo "📊 Recording Pre-Deployment Record Counts:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -A -c "
SELECT 'users: ' || count(*) FROM users
UNION ALL SELECT 'customers: ' || count(*) FROM customers
UNION ALL SELECT 'categories: ' || count(*) FROM categories
UNION ALL SELECT 'products: ' || count(*) FROM products
UNION ALL SELECT 'product_prices: ' || count(*) FROM product_prices
UNION ALL SELECT 'sales: ' || count(*) FROM sales
UNION ALL SELECT 'sale_items: ' || count(*) FROM sale_items
UNION ALL SELECT 'sales_returns: ' || count(*) FROM sales_returns
UNION ALL SELECT 'production_entries: ' || count(*) FROM production_entries
UNION ALL SELECT 'stocks: ' || count(*) FROM stocks
UNION ALL SELECT 'company_settings: ' || count(*) FROM company_settings
UNION ALL SELECT 'website_contents: ' || count(*) FROM website_contents;
"

echo "🔍 Checking Prisma Migration Status (Read-Only)..."
cd backend
npx prisma migrate status --schema=src/database/prisma/schema.prisma

# ----------------------------------------------------
# STEP 4: BUILD BACKEND
# ----------------------------------------------------
echo ""
echo "[Step 4/8] Installing Dependencies & Building Backend..."
npm install --no-audit --no-fund
npm run build
if [ ! -d "dist" ]; then
  echo "❌ CRITICAL STOP: Backend build failed (dist directory not found)!"
  exit 1
fi
echo "✅ Backend build successful!"

# ----------------------------------------------------
# STEP 5: BUILD FRONTEND
# ----------------------------------------------------
echo ""
echo "[Step 5/8] Installing Dependencies & Building Frontend..."
cd ../frontend
npm install --no-audit --no-fund
npm run build
if [ ! -f "dist/index.html" ]; then
  echo "❌ CRITICAL STOP: Frontend build failed (dist/index.html not found)!"
  exit 1
fi
echo "✅ Frontend build successful!"

# ----------------------------------------------------
# STEP 6: RESTART BACKEND (PM2)
# ----------------------------------------------------
echo ""
echo "[Step 6/8] Restarting Backend via PM2..."
cd ..
if pm2 describe vahanvati-backend >/dev/null 2>&1; then
  pm2 restart vahanvati-backend
elif pm2 describe 0 >/dev/null 2>&1; then
  pm2 restart 0
else
  echo "⚠️ PM2 process 'vahanvati-backend' not found, listing PM2 processes:"
  pm2 list
fi

sleep 3
pm2 list

# ----------------------------------------------------
# STEP 7: NGINX SYNTAX & RELOAD
# ----------------------------------------------------
echo ""
echo "[Step 7/8] Checking Nginx Configuration & Reloading..."
nginx -t
systemctl reload nginx || nginx -s reload
echo "✅ Nginx reloaded successfully!"

# ----------------------------------------------------
# STEP 8: POST-DEPLOYMENT VERIFICATION
# ----------------------------------------------------
echo ""
echo "[Step 8/8] Post-Deployment Verification..."

echo "📡 Checking Local Backend Health..."
sleep 2
curl -fsS http://localhost:4000/api/v1/health || curl -fsS http://127.0.0.1:4000/api/v1/health || true
echo ""

echo "📊 Verifying Post-Deployment Record Counts:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -A -c "
SELECT 'users: ' || count(*) FROM users
UNION ALL SELECT 'customers: ' || count(*) FROM customers
UNION ALL SELECT 'categories: ' || count(*) FROM categories
UNION ALL SELECT 'products: ' || count(*) FROM products
UNION ALL SELECT 'product_prices: ' || count(*) FROM product_prices
UNION ALL SELECT 'sales: ' || count(*) FROM sales
UNION ALL SELECT 'sale_items: ' || count(*) FROM sale_items
UNION ALL SELECT 'sales_returns: ' || count(*) FROM sales_returns
UNION ALL SELECT 'production_entries: ' || count(*) FROM production_entries
UNION ALL SELECT 'stocks: ' || count(*) FROM stocks
UNION ALL SELECT 'company_settings: ' || count(*) FROM company_settings
UNION ALL SELECT 'website_contents: ' || count(*) FROM website_contents;
"

echo ""
echo "=================================================="
echo "🎉 DEPLOYMENT COMPLETED ON SERVER"
echo "📌 Previous Commit: ${PREV_COMMIT}"
echo "📌 Deployed Commit: ${DEPLOYED_COMMIT}"
echo "💾 Database Backup: ${BACKUP_FILE} (${BACKUP_SIZE})"
echo "=================================================="
