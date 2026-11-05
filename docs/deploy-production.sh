#!/usr/bin/env bash
# ====================================================================
# Vahanvati Gruh Udhyog — Production Controlled Deployment Script
# Target: 148.135.137.247
# ====================================================================
set -euo pipefail

# --------------------------------------------------------------------
# STEP 0: ARGUMENT VALIDATION & PREFLIGHT SAFETY
# --------------------------------------------------------------------
if [ -z "${1:-}" ]; then
  echo "❌ Error: Target commit SHA is required as the first argument."
  echo "Usage: $0 <40-character-commit-sha>"
  exit 1
fi

TARGET_COMMIT="$1"
if ! [[ "$TARGET_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "❌ Error: Target commit must be a valid 40-character hexadecimal git SHA."
  exit 1
fi

REPO_DIR="/var/www/html/vahanvati-gruh-udhyog"
if [ -d "$REPO_DIR" ]; then
  cd "$REPO_DIR"
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Error: Current directory is not a git repository."
  exit 1
fi

# Strict check for clean working tree (no uncommitted tracked or untracked changes)
SERVER_STATUS=$(git status --porcelain)
if [ -n "$SERVER_STATUS" ]; then
  echo "❌ CRITICAL STOP: Server working tree is not clean! Uncommitted changes found:"
  git status --short
  echo "Aborting deployment to prevent overwriting or packaging unexpected server files."
  exit 1
fi

PREV_COMMIT=$(git rev-parse HEAD)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
BACKUP_FILE="${BACKUP_DIR}/vahanvati_pre_deploy_${TIMESTAMP}.sql"

# Persistent deployment rollback state stored OUTSIDE git repository to prevent working-tree dirtying
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/root/deploy_state}"
mkdir -p "$DEPLOY_STATE_DIR" 2>/dev/null || DEPLOY_STATE_DIR="/tmp/vahanvati_deploy_state"
mkdir -p "$DEPLOY_STATE_DIR" 2>/dev/null || true
chmod 700 "$DEPLOY_STATE_DIR" 2>/dev/null || true
DEPLOY_STATE_FILE="${DEPLOY_STATE_DIR}/deployment_state_${TARGET_COMMIT}_${TIMESTAMP}.env"
DEPLOY_LATEST_STATE_LINK="${DEPLOY_STATE_DIR}/deployment_state_latest.env"

echo "=================================================="
echo "🚀 VAHANVATI GRUH UDHYOG — PRODUCTION DEPLOYMENT"
echo "📅 Deployment Time:        $(date)"
echo "📌 Current Baseline Commit: ${PREV_COMMIT}"
echo "🎯 Target Release Commit:  ${TARGET_COMMIT}"
echo "=================================================="

# Fetch latest remote refs (does not touch working files, HEAD, or .env)
echo "🔍 Fetching remote refs to verify target commit..."
git fetch origin main
if ! git cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null; then
  echo "❌ Error: Target commit ${TARGET_COMMIT} does not exist in repository!"
  exit 1
fi

# Check if backend dependencies changed between baseline and target
BACKEND_PKG_CHANGED="false"
DIFF_STATUS=0
git diff --quiet "${PREV_COMMIT}" "${TARGET_COMMIT}" -- backend/package.json backend/package-lock.json 2>/dev/null || DIFF_STATUS=$?
if [ "$DIFF_STATUS" -eq 1 ]; then
  BACKEND_PKG_CHANGED="true"
  echo "⚠️ Notice: Backend dependencies differ between baseline and target commit."
elif [ "$DIFF_STATUS" -gt 1 ]; then
  echo "❌ Error: Failed to compare git tree differences for backend dependencies (exit code ${DIFF_STATUS})."
  exit 1
fi

# --------------------------------------------------------------------
# STEP 1: PRODUCTION DATABASE BACKUP (BEFORE ANY CODE MODIFICATION)
# --------------------------------------------------------------------
echo ""
echo "[Step 1/7] Creating Production Database Backup (Pre-Deployment)..."

# Preflight Disk Space Check (Minimum 1024MB free required in BACKUP_DIR)
mkdir -p "$BACKUP_DIR" 2>/dev/null || true 2>/dev/null || true
chmod 700 "$BACKUP_DIR" 2>/dev/null || true
MIN_REQUIRED_MB=1024
AVAILABLE_MB=$(df -m "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
if [ -n "$AVAILABLE_MB" ] && [ "$AVAILABLE_MB" -ne 0 ] 2>/dev/null; then
  if [ "$AVAILABLE_MB" -lt "$MIN_REQUIRED_MB" ]; then
    echo "❌ CRITICAL STOP: Insufficient free disk space in ${BACKUP_DIR}! Required: ${MIN_REQUIRED_MB}MB, Available: ${AVAILABLE_MB}MB."
    echo "Aborting deployment before taking backup or touching working tree."
    exit 1
  fi
  echo "✅ Preflight disk check passed: ${AVAILABLE_MB}MB free in ${BACKUP_DIR}."
fi

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
if [ -z "${RAW_URL:-}" ]; then
  echo "❌ Error: DATABASE_URL not found in $ENV_FILE!"
  exit 1
fi

export PGHOST="localhost"
export PGPORT="5432"
export PGUSER="vahanvati_user"
export PGDATABASE="vahanvati_db"
export PGPASSWORD=""

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

# Fallback parameter parsing if node was not available
if [ -z "${PGPASSWORD:-}" ]; then
  no_proto="${RAW_URL#*://}"
  pass_and_rest="${no_proto#*:}"
  PGPASSWORD="${pass_and_rest%@localhost*}"
  if [[ "$PGPASSWORD" == *"@127.0.0.1"* ]]; then
    PGPASSWORD="${PGPASSWORD%@127.0.0.1*}"
  fi
  export PGPASSWORD
fi

if [ -z "${PGPASSWORD:-}" ]; then
  echo "❌ Error: Could not parse database password from environment."
  exit 1
fi

mkdir -p "$BACKUP_DIR" 2>/dev/null || true
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

if [ -e "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup destination $BACKUP_FILE already exists. Refusing to overwrite!"
  exit 1
fi

echo "💾 Running pg_dump to ${BACKUP_FILE}..."
(
  umask 077
  pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" > "$BACKUP_FILE"
)

if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ CRITICAL STOP: Backup file is empty or failed to create!"
  exit 1
fi

chmod 600 "$BACKUP_FILE" 2>/dev/null || true

# Verify SQL dump header & footer completeness
if ! head -n 30 "$BACKUP_FILE" | grep -qi "PostgreSQL database dump"; then
  echo "❌ CRITICAL STOP: Backup header verification failed! Invalid dump file."
  exit 1
fi

if ! tail -n 30 "$BACKUP_FILE" | grep -qi "PostgreSQL database dump complete"; then
  echo "❌ CRITICAL STOP: Backup footer verification failed! Incomplete or truncated dump."
  exit 1
fi

# Structural inspection: verify presence of essential table schemas
if ! grep -q "CREATE TABLE" "$BACKUP_FILE"; then
  echo "❌ CRITICAL STOP: Backup structural verification failed! No table definitions found in ${BACKUP_FILE}."
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | awk '{print $1}' || echo "unknown")
echo "✅ Database backup verified and secured:"
echo "   File:        ${BACKUP_FILE}"
echo "   Size:        ${BACKUP_SIZE}"
echo "   Permissions: 0600 (owner-only)"

# --------------------------------------------------------------------
# STEP 2: READ-ONLY DATABASE & PRISMA STATUS CHECK (ZERO MUTATIONS)
# --------------------------------------------------------------------
echo ""
echo "[Step 2/7] Inspecting Production Database Status (Read-Only)..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --no-align -c "SELECT current_database(), current_user, inet_server_addr(), version();"

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
(cd backend && npx prisma migrate status --schema=src/database/prisma/schema.prisma)

# --------------------------------------------------------------------
# STEP 3: CHECKOUT TARGET COMMIT
# --------------------------------------------------------------------
echo ""
echo "[Step 3/7] Checking out target commit ${TARGET_COMMIT}..."
git checkout "${TARGET_COMMIT}"

DEPLOYED_COMMIT=$(git rev-parse HEAD)
echo "✅ Checked out commit: ${DEPLOYED_COMMIT}"
if [ "${DEPLOYED_COMMIT}" != "${TARGET_COMMIT}" ]; then
  echo "❌ CRITICAL STOP: HEAD (${DEPLOYED_COMMIT}) does not match target (${TARGET_COMMIT})!"
  exit 1
fi

# --------------------------------------------------------------------
# STEP 4: BUILD BACKEND (WITH VERSIONED BACKUP PRESERVATION)
# --------------------------------------------------------------------
echo ""
echo "[Step 4/7] Installing Dependencies & Building Backend..."
cd "${REPO_DIR}/backend"

BACKEND_RELEASES_DIR="${REPO_DIR}/backend/releases"
mkdir -p "$BACKEND_RELEASES_DIR"
BACKEND_PREV_BACKUP="${BACKEND_RELEASES_DIR}/backend_baseline_${PREV_COMMIT}_${TIMESTAMP}"

# Preserve current working backend dist for rollback
if [ -d "dist" ]; then
  rm -rf "$BACKEND_PREV_BACKUP"
  cp -r dist "$BACKEND_PREV_BACKUP"
  echo "💾 Preserved previous backend build at: ${BACKEND_PREV_BACKUP}"
fi

npm install --no-audit --no-fund
npm run build

if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
  echo "❌ CRITICAL STOP: Backend build failed! (dist/server.js missing)"
  if [ -d "$BACKEND_PREV_BACKUP" ]; then
    echo "🔄 Restoring previous backend dist and baseline tree..."
    rm -rf dist
    cp -r "$BACKEND_PREV_BACKUP" dist
    git checkout "${PREV_COMMIT}"
    if [ "${BACKEND_PKG_CHANGED}" = "true" ]; then
      npm install --no-audit --no-fund || true
    fi
  fi
  exit 1
fi
echo "✅ Backend build successful!"

# --------------------------------------------------------------------
# STEP 5: VERSIONED FRONTEND BUILD & ATOMIC SYMLINK ACTIVATION
# --------------------------------------------------------------------
echo ""
echo "[Step 5/7] Building Frontend into Unique Versioned Release..."
cd "${REPO_DIR}/frontend"

FRONTEND_RELEASES_DIR="${REPO_DIR}/frontend/releases"
mkdir -p "$FRONTEND_RELEASES_DIR"
NEW_RELEASE_DIR="${FRONTEND_RELEASES_DIR}/release_${TARGET_COMMIT}_${TIMESTAMP}"

# Recoverable First-Run Migration from legacy directory to versioned symlink
# (Not claimed as zero-downtime, but engineered with full data preservation and automatic recovery)
IS_FIRST_RUN_MIGRATION="false"
LEGACY_RELEASE_DIR=""

if [ ! -L "dist" ] && [ -d "dist" ]; then
  IS_FIRST_RUN_MIGRATION="true"
  echo "📦 [Migration] Preparing first-run migration of legacy dist directory to versioned symlink..."
  LEGACY_RELEASE_DIR="${FRONTEND_RELEASES_DIR}/legacy_baseline_${PREV_COMMIT}_${TIMESTAMP}"

  # 1. Copy full contents to legacy release directory while keeping live dist intact
  cp -a dist "$LEGACY_RELEASE_DIR"
  if [ ! -f "${LEGACY_RELEASE_DIR}/index.html" ]; then
    echo "❌ CRITICAL STOP: Failed to copy legacy dist to ${LEGACY_RELEASE_DIR}. Live dist unchanged."
    rm -rf "$LEGACY_RELEASE_DIR"
    exit 1
  fi

  # 2. Prepare the symlink in a temporary path
  DIST_MIGRATE_TMP="${REPO_DIR}/frontend/dist_migrate_symlink_tmp"
  rm -f "$DIST_MIGRATE_TMP"
  ln -sfn "$LEGACY_RELEASE_DIR" "$DIST_MIGRATE_TMP"

  # 3. Rename live dist to backup with immediate automatic recovery
  DIST_MIGRATION_BACKUP="${REPO_DIR}/frontend/dist_legacy_backup_${TIMESTAMP}"
  if ! mv dist "$DIST_MIGRATION_BACKUP"; then
    echo "❌ CRITICAL STOP: Failed to preserve legacy dist directory. Live dist unchanged."
    rm -f "$DIST_MIGRATE_TMP"
    exit 1
  fi

  # 4. Activate prepared symlink
  if ! mv "$DIST_MIGRATE_TMP" dist; then
    echo "🚨 Migration symlink activation failed! Restoring legacy dist immediately..."
    mv "$DIST_MIGRATION_BACKUP" dist
    echo "❌ CRITICAL STOP: Restored legacy dist. Migration aborted."
    exit 1
  fi

  # 5. Validate migrated symlink
  if [ ! -L "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "🚨 Migrated symlink validation failed! Restoring legacy dist..."
    rm -f dist
    mv "$DIST_MIGRATION_BACKUP" dist
    exit 1
  fi

  # Clean temporary migration backup now that symlink is verified
  rm -rf "$DIST_MIGRATION_BACKUP"
  echo "✅ Recoverable migration completed: dist is now a verified symlink -> ${LEGACY_RELEASE_DIR}"
fi

# Record and strictly validate current active release for rollback
PREV_ACTIVE_RELEASE=""
if [ -L "dist" ]; then
  PREV_ACTIVE_RELEASE=$(node -e 'try{console.log(require("fs").realpathSync("dist"))}catch(e){console.log("")}')
fi

if [ -z "$PREV_ACTIVE_RELEASE" ] || [ ! -d "$PREV_ACTIVE_RELEASE" ]; then
  echo "❌ CRITICAL STOP: Could not resolve valid active frontend release directory!"
  echo "dist symlink is either missing, dangling, or points to a non-existent path: ${PREV_ACTIVE_RELEASE:-none}"
  exit 1
fi
echo "📌 Currently active frontend release: ${PREV_ACTIVE_RELEASE}"

# Record exact deployment rollback state manifest to persistent file OUTSIDE git repository
cat <<EOF > "$DEPLOY_STATE_FILE"
PREV_COMMIT="${PREV_COMMIT}"
TARGET_COMMIT="${TARGET_COMMIT}"
BACKEND_PREV_BACKUP="${BACKEND_PREV_BACKUP}"
BACKEND_PKG_CHANGED="${BACKEND_PKG_CHANGED}"
PREV_ACTIVE_RELEASE="${PREV_ACTIVE_RELEASE}"
LEGACY_RELEASE_DIR="${LEGACY_RELEASE_DIR:-}"
IS_FIRST_RUN_MIGRATION="${IS_FIRST_RUN_MIGRATION:-false}"
BACKUP_FILE="${BACKUP_FILE}"
TIMESTAMP="${TIMESTAMP}"
EOF
chmod 600 "$DEPLOY_STATE_FILE"
ln -sfn "$DEPLOY_STATE_FILE" "$DEPLOY_LATEST_STATE_LINK"

npm install --no-audit --no-fund

# Clean release target if it already exists
rm -rf "$NEW_RELEASE_DIR"

# Build strictly outside the live webroot
echo "🔨 Compiling frontend into isolated release directory: ${NEW_RELEASE_DIR}..."
npx tsc
npx vite build --outDir "$NEW_RELEASE_DIR"

# Validate complete release integrity before activation
if [ ! -f "${NEW_RELEASE_DIR}/index.html" ] || [ ! -s "${NEW_RELEASE_DIR}/index.html" ] || [ ! -d "${NEW_RELEASE_DIR}/assets" ]; then
  echo "❌ CRITICAL STOP: Frontend release validation failed! Missing index.html or assets."
  echo "Live webroot 'dist' remains 100% untouched and active on ${PREV_ACTIVE_RELEASE}."
  rm -rf "$NEW_RELEASE_DIR"
  exit 1
fi

echo "📦 Release validation PASSED. Activating new frontend release..."

# Atomic Symlink Switch via rename(2)
# Step A: Create temporary symlink pointing to the new release
DIST_TMP="${REPO_DIR}/frontend/dist_symlink_tmp"
rm -f "$DIST_TMP"
ln -sfn "$NEW_RELEASE_DIR" "$DIST_TMP"

# Step B: Atomically swap symlink over dist using renameSync (POSIX rename syscall)
node -e '
  const fs = require("fs");
  const tmp = process.argv[1];
  const target = process.argv[2];
  fs.renameSync(tmp, target);
' "$DIST_TMP" "dist"

echo "✅ Frontend release activated atomically via symlink -> ${NEW_RELEASE_DIR}"

# --------------------------------------------------------------------
# STEP 6: RESTART BACKEND (PM2 EXACT PROCESS NAME ONLY)
# --------------------------------------------------------------------
echo ""
echo "[Step 6/7] Restarting PM2 process 'vahanvati-backend'..."
cd "${REPO_DIR}"

if ! pm2 describe vahanvati-backend >/dev/null 2>&1; then
  echo "❌ CRITICAL STOP: PM2 process 'vahanvati-backend' not found!"
  echo "Refusing to guess process IDs or restart other services on shared VPS."
  exit 1
fi

if ! pm2 restart vahanvati-backend; then
  echo "❌ CRITICAL STOP: 'pm2 restart vahanvati-backend' failed!"
  echo "Refusing to guess process IDs or restart other services on shared VPS."
  exit 1
fi

sleep 3
pm2 show vahanvati-backend

# --------------------------------------------------------------------
# STEP 7: STRICT POST-DEPLOYMENT HEALTH VERIFICATION
# --------------------------------------------------------------------
echo ""
echo "[Step 7/7] Strict Post-Deployment Health Verification..."

HEALTH_URL="http://127.0.0.1:4000/api/v1/health"
HEALTH_OK=false
HEALTH_STATUS=""
DB_STATUS=""

for attempt in 1 2 3 4 5; do
  echo "   [Attempt ${attempt}/5] Probing ${HEALTH_URL}..."
  RES_FILE="/tmp/vahanvati_health_probe.json"
  HTTP_CODE=$(curl -s -o "$RES_FILE" -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] && [ -s "$RES_FILE" ]; then
    HEALTH_STATUS=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).status||"")}catch(e){}' "$RES_FILE" 2>/dev/null || true)
    DB_STATUS=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).database||"")}catch(e){}' "$RES_FILE" 2>/dev/null || true)
    rm -f "$RES_FILE"
    if [ "$HEALTH_STATUS" = "healthy" ] && [ "$DB_STATUS" = "connected" ]; then
      HEALTH_OK=true
      break
    fi
  fi
  rm -f "$RES_FILE"
  sleep 2
done

if [ "$HEALTH_OK" != "true" ]; then
  echo "❌ CRITICAL STOP: Health check FAILED after 5 attempts!"
  echo "   HTTP Code:  ${HTTP_CODE:-unknown}"
  echo "   App Status: ${HEALTH_STATUS:-unknown}"
  echo "   DB Status:  ${DB_STATUS:-unknown}"
  echo ""
  echo "=================================================="
  echo "🚨 DEPLOYMENT FAILURE — EXACT ROLLBACK INSTRUCTIONS"
  echo "=================================================="
  echo "1. Backend Rollback (Code, Dependencies & Build Artifacts):"
  echo "   cd ${REPO_DIR}"
  echo "   git checkout ${PREV_COMMIT}"
  echo "   cd ${REPO_DIR}/backend"
  if [ -n "${BACKEND_PREV_BACKUP}" ] && [ -d "${BACKEND_PREV_BACKUP}" ]; then
    echo "   # Verified backend baseline directory exists: ${BACKEND_PREV_BACKUP}"
    echo "   FAILED_BACKEND=\"${REPO_DIR}/backend/releases/failed_backend_\$(date +%Y%m%d_%H%M%S)\""
    echo "   if [ -d \"dist\" ]; then mv \"dist\" \"\$FAILED_BACKEND\"; fi"
    echo "   cp -r \"${BACKEND_PREV_BACKUP}\" \"dist\""
  else
    echo "   echo '❌ CRITICAL ERROR: Backend baseline backup directory missing: ${BACKEND_PREV_BACKUP}'"
    echo "   exit 1"
  fi
  if [ "${BACKEND_PKG_CHANGED}" = "true" ]; then
    echo "   echo '📦 Reinstalling previous backend dependencies...'"
    echo "   npm install --no-audit --no-fund"
  fi
  echo "   if [ ! -f \"dist/server.js\" ]; then echo \"❌ Backend rollback failed: dist/server.js missing!\"; exit 1; fi"
  echo "   if ! node -c dist/server.js 2>/dev/null; then echo \"❌ Backend rollback failed: dist/server.js syntax invalid!\"; exit 1; fi"
  echo "   if ! node -e 'const pkg=require(\"./package.json\");for(const d of Object.keys(pkg.dependencies||{})){if(!d.startsWith(\"@types/\"))require.resolve(d,{paths:[process.cwd()]});}' 2>/dev/null; then"
  echo "     echo '❌ Backend rollback failed: Required production dependencies failed module resolution! Refusing to restart PM2.';"
  echo "     exit 1;"
  echo "   fi"
  echo "   pm2 restart vahanvati-backend"
  echo "   pm2 show vahanvati-backend"
  echo ""
  echo "2. Frontend Rollback (Exact Symlink Target Restoration):"
  EXACT_FE_TARGET="${PREV_ACTIVE_RELEASE:-${LEGACY_RELEASE_DIR:-}}"
  if [ -n "${EXACT_FE_TARGET}" ] && [ -d "${EXACT_FE_TARGET}" ]; then
    echo "   # Verified frontend baseline target exists: ${EXACT_FE_TARGET}"
    echo "   cd ${REPO_DIR}/frontend"
    echo "   rm -f dist_rollback_tmp"
    echo "   ln -sfn \"${EXACT_FE_TARGET}\" dist_rollback_tmp"
    echo "   node -e 'require(\"fs\").renameSync(\"dist_rollback_tmp\", \"dist\")'"
    echo "   if [ ! -f \"dist/index.html\" ]; then echo \"❌ Frontend rollback verification failed: dist/index.html missing!\"; exit 1; fi"
    echo "   echo \"✅ Frontend rolled back to exact target: \$(node -e 'console.log(require(\"fs\").realpathSync(\"dist\"))')\""
  else
    echo "   echo '❌ CRITICAL ERROR: Frontend baseline target missing: ${EXACT_FE_TARGET}'"
    echo "   exit 1"
  fi
  echo ""
  echo "3. Deployment Rollback State Manifest (Preserved for Audit):"
  echo "   ${DEPLOY_STATE_FILE}"
  echo ""
  echo "4. Production Database Backup (DO NOT RESTORE UNLESS EXPLICITLY APPROVED):"
  echo "   ${BACKUP_FILE}"
  echo "=================================================="
  exit 1
fi

echo "✅ Backend is healthy and database is connected!"

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
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "📌 Previous Baseline Commit: ${PREV_COMMIT}"
echo "📌 Active Deployed Commit:   ${DEPLOYED_COMMIT}"
echo "📦 Active Frontend Release:  ${NEW_RELEASE_DIR}"
echo "💾 Database Backup:          ${BACKUP_FILE} (${BACKUP_SIZE})"
echo "🔒 Backup Permissions:       0600 (owner-only)"
echo "🌐 Shared VPS Isolation:     No Nginx reload, only 'vahanvati-backend' restarted"
echo "=================================================="
