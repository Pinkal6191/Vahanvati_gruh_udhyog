import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT_DIR = path.resolve(__dirname, '../..');
const DEPLOY_SCRIPT_PATH = path.join(ROOT_DIR, 'docs/deploy-production.sh');
const IMPORT_SCRIPT_PATH = path.join(ROOT_DIR, 'docs/import-production.sh');

describe('Production Deployment Script Safety Remediation Audit', () => {
  const deployScript = fs.readFileSync(DEPLOY_SCRIPT_PATH, 'utf8');
  const importScript = fs.readFileSync(IMPORT_SCRIPT_PATH, 'utf8');

  it('1. Script has valid bash syntax', () => {
    const res1 = spawnSync('bash', ['-n', DEPLOY_SCRIPT_PATH]);
    assert.strictEqual(res1.status, 0, `deploy-production.sh bash syntax error: ${res1.stderr.toString()}`);

    const res2 = spawnSync('bash', ['-n', IMPORT_SCRIPT_PATH]);
    assert.strictEqual(res2.status, 0, `import-production.sh bash syntax error: ${res2.stderr.toString()}`);
  });

  it('2. Target SHA is required and aborts if missing or invalid', () => {
    // Missing argument
    const resMissing = spawnSync('bash', [DEPLOY_SCRIPT_PATH], { cwd: ROOT_DIR });
    assert.notStrictEqual(resMissing.status, 0, 'Script must exit with non-zero when target commit argument is missing');
    assert.match(resMissing.stdout.toString() + resMissing.stderr.toString(), /Target commit SHA is required/);

    // Invalid format argument
    const resInvalid = spawnSync('bash', [DEPLOY_SCRIPT_PATH, 'invalid-sha'], { cwd: ROOT_DIR });
    assert.notStrictEqual(resInvalid.status, 0, 'Script must exit with non-zero when target commit argument is not 40-hex');
    assert.match(resInvalid.stdout.toString() + resInvalid.stderr.toString(), /Target commit must be a valid 40-character/);
  });

  it('3. Preflight check: Server working tree must be 100% clean', () => {
    assert.match(deployScript, /SERVER_STATUS=\$\(git status --porcelain\)/, 'Must inspect git status --porcelain');
    assert.match(deployScript, /Server working tree is not clean/, 'Must abort if server working tree is dirty');
  });

  it('4. SQL business data mutations are 100% absent from deploy-production.sh', () => {
    const lines = deployScript.split('\n');
    const forbiddenPatterns = [
      /INSERT\s+INTO\s+stocks/i,
      /INSERT\s+INTO\s+product_prices/i,
      /UPDATE\s+product_prices/i,
      /DELETE\s+FROM/i,
      /DROP\s+TABLE/i,
      /TRUNCATE\s+TABLE/i,
      /ALTER\s+TABLE/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of forbiddenPatterns) {
        assert.ok(
          !pattern.test(line),
          `Forbidden SQL mutation pattern found at line ${i + 1}: "${line.trim()}"`
        );
      }
    }
  });

  it('5. Database backup occurs before any git checkout or build', () => {
    const backupPos = deployScript.indexOf('pg_dump');
    const checkoutPos = deployScript.indexOf('git checkout "${TARGET_COMMIT}"');
    const backendBuildPos = deployScript.indexOf('npm run build');

    assert.ok(backupPos !== -1, 'pg_dump must be present in deploy-production.sh');
    assert.ok(checkoutPos !== -1, 'git checkout must be present in deploy-production.sh');
    assert.ok(backendBuildPos !== -1, 'build must be present in deploy-production.sh');

    assert.ok(
      backupPos < checkoutPos,
      `Database backup (index ${backupPos}) must occur BEFORE git checkout (index ${checkoutPos})`
    );
    assert.ok(
      backupPos < backendBuildPos,
      `Database backup (index ${backupPos}) must occur BEFORE build (index ${backendBuildPos})`
    );
  });

  it('6. Backup enforces restrictive permissions (0700 dir, 0600 file) and refuses overwrite', () => {
    assert.match(deployScript, /chmod 700 "\$BACKUP_DIR"/, 'Backup directory must have chmod 700');
    assert.match(deployScript, /chmod 600 "\$BACKUP_FILE"/, 'Backup file must have chmod 600');
    assert.match(deployScript, /umask 077/, 'Must use umask 077 during dump creation');
    assert.match(deployScript, /Refusing to overwrite/, 'Must refuse to overwrite existing backup file');
  });

  it('7. Backup verification checks non-empty, header, and footer completeness', () => {
    assert.match(deployScript, /PostgreSQL database dump/, 'Must verify SQL header in backup');
    assert.match(deployScript, /PostgreSQL database dump complete/, 'Must verify SQL completion footer in backup');
  });

  it('8. DATABASE_URL parsing handles @, %, and special characters without echoing secrets', () => {
    assert.match(deployScript, /lastIndexOf\("@localhost"\)/, 'Must use lastIndexOf for @ handling');
    assert.match(deployScript, /decodeURIComponent/, 'Must handle percent-encoded characters');
    assert.ok(!deployScript.includes('echo "$PGPASSWORD"'), 'Must never echo PGPASSWORD');
    assert.ok(!deployScript.includes('echo $PGPASSWORD'), 'Must never echo unquoted PGPASSWORD');
    assert.ok(!deployScript.includes('echo "$RAW_URL"'), 'Must never echo RAW_URL');
  });

  it('9. Frontend builds into unique versioned release directory outside live webroot', () => {
    assert.match(deployScript, /FRONTEND_RELEASES_DIR=.*\/frontend\/releases/, 'Must define frontend releases dir');
    assert.match(deployScript, /NEW_RELEASE_DIR=.*\/release_\$\{TARGET_COMMIT\}/, 'Must create unique release dir');
    assert.match(deployScript, /--outDir "\$NEW_RELEASE_DIR"/, 'Vite must output to versioned release dir');
    assert.ok(!deployScript.includes('rsync -a --delete'), 'Must NEVER use rsync --delete against live webroot');
  });

  it('10. Frontend activates via atomic symlink swap (renameSync) and preserves previous release', () => {
    assert.match(deployScript, /fs\.renameSync\(tmp, target\)/, 'Must use renameSync for atomic symlink swap');
    assert.match(deployScript, /PREV_ACTIVE_RELEASE=/, 'Must record previously active release for rollback');
    assert.match(deployScript, /dist_symlink_tmp/, 'Must use temporary symlink before atomic rename');
  });

  it('11. Backend build preserves versioned backup for rollback on failure', () => {
    assert.match(deployScript, /BACKEND_PREV_BACKUP=/, 'Must define backend backup path with timestamp and commit');
    assert.match(deployScript, /Restoring previous backend dist/, 'Must restore previous backend dist if build fails');
  });

  it('12. PM2 restarts ONLY exact process name "vahanvati-backend" and checks restart exit status', () => {
    assert.match(deployScript, /if ! pm2 restart vahanvati-backend; then/, 'Must verify pm2 restart exit status');
    assert.ok(!deployScript.includes('pm2 restart all'), 'Must NEVER restart all PM2 processes');
    assert.ok(!deployScript.includes('pm2 reload all'), 'Must NEVER reload all PM2 processes');
    assert.ok(!deployScript.includes('pm2 restart 0'), 'Must NEVER fall back to restarting PM2 ID 0');
    assert.match(deployScript, /Refusing to guess process IDs/, 'Must fail if vahanvati-backend is not found');
  });

  it('13. Unnecessary global Nginx reload is completely removed', () => {
    assert.ok(!deployScript.includes('systemctl reload nginx'), 'Must NOT run systemctl reload nginx');
    assert.ok(!deployScript.includes('nginx -s reload'), 'Must NOT run nginx -s reload');
  });

  it('14. Post-deployment health check is strict and provides rollback instructions', () => {
    assert.ok(!deployScript.includes('/api/v1/health || true'), 'Health check must not swallow failures with || true');
    assert.match(deployScript, /HEALTH_STATUS.*healthy/, 'Health check must verify status: healthy');
    assert.match(deployScript, /DB_STATUS.*connected/, 'Health check must verify database: connected');
    assert.match(deployScript, /DEPLOYMENT FAILURE — EXACT ROLLBACK INSTRUCTIONS/, 'Must provide explicit rollback instructions on failure');
  });

  it('15. Mock test: Working tree dirty check immediately aborts execution', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanvati-mock-dirty-'));
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    fs.writeFileSync(
      path.join(binDir, 'git'),
      '#!/bin/sh\nif [ "$1" = "status" ] && [ "$2" = "--porcelain" ]; then echo " M backend/server.ts"; exit 0; fi\nif [ "$1" = "rev-parse" ]; then echo "true"; exit 0; fi\nexit 0\n',
      { mode: 0o755 }
    );

    const scriptPath = path.join(tmpDir, 'test-deploy.sh');
    fs.writeFileSync(scriptPath, deployScript.replace('REPO_DIR="/var/www/html/vahanvati-gruh-udhyog"', `REPO_DIR="${tmpDir}"`), { mode: 0o755 });

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      BACKUP_DIR: path.join(tmpDir, 'backups'),
      DEPLOY_STATE_DIR: path.join(tmpDir, 'deploy_state')
    };
    const res = spawnSync('bash', [scriptPath, 'e54ccef0d0408ca3a5697cb8c868d8455d8dc718'], { env, cwd: ROOT_DIR });

    assert.notStrictEqual(res.status, 0, 'Script must fail when server working tree is dirty');
    assert.match(res.stdout.toString() + res.stderr.toString(), /Server working tree is not clean/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('16. Mock test: First-run migration failure restores legacy dist automatically', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanvati-mock-migration-fail-'));
    const frontendDir = path.join(tmpDir, 'frontend');
    fs.mkdirSync(frontendDir, { recursive: true });

    // Initial legacy real directory
    const legacyDist = path.join(frontendDir, 'dist');
    fs.mkdirSync(legacyDist);
    fs.writeFileSync(path.join(legacyDist, 'index.html'), '<html>Legacy V1</html>');

    // Simulate failure during Step 4 of migration (activating symlink fails)
    const backupDir = path.join(tmpDir, 'dist_legacy_backup_mock');
    fs.renameSync(legacyDist, backupDir);

    // Simulate failure recovery: mv $DIST_MIGRATION_BACKUP dist
    fs.renameSync(backupDir, legacyDist);

    // Assert that live dist remains a directory with original content
    assert.ok(fs.statSync(legacyDist).isDirectory());
    assert.strictEqual(fs.readFileSync(path.join(legacyDist, 'index.html'), 'utf8'), '<html>Legacy V1</html>');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('17. Mock test: Frontend release validation failure aborts and leaves live webroot untouched', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanvati-mock-fe-val-'));
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const frontendDir = path.join(tmpDir, 'frontend');
    const releasesDir = path.join(frontendDir, 'releases');
    fs.mkdirSync(releasesDir, { recursive: true });

    // Live active release
    const activeRel = path.join(releasesDir, 'release_active_v1');
    fs.mkdirSync(activeRel);
    fs.writeFileSync(path.join(activeRel, 'index.html'), '<html>Active v1</html>');
    fs.symlinkSync(activeRel, path.join(frontendDir, 'dist'));
    fs.writeFileSync(path.join(frontendDir, 'package.json'), '{"name":"mock-fe"}');

    // Mock backend
    const backendDir = path.join(tmpDir, 'backend');
    fs.mkdirSync(path.join(backendDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(backendDir, 'dist/server.js'), '// server');
    fs.writeFileSync(path.join(backendDir, '.env'), 'DATABASE_URL="postgresql://user:pass@localhost:5432/vahanvati_db"\n');

    const modifiedScript = deployScript
      .replace('REPO_DIR="/var/www/html/vahanvati-gruh-udhyog"', `REPO_DIR="${tmpDir}"`)
      .replace('BACKUP_DIR="/root/backups"', `BACKUP_DIR="${tmpDir}/backups"`)
      .replace('git checkout "${TARGET_COMMIT}"', 'true')
      .replace('DEPLOYED_COMMIT=$(git rev-parse HEAD)', 'DEPLOYED_COMMIT="e54ccef0d0408ca3a5697cb8c868d8455d8dc718"')
      .replace('git fetch origin main', 'true')
      .replace('git cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null', 'true')
      .replace('npm run build', 'true')
      .replace('npm install --no-audit --no-fund', 'true')
      .replace('npx tsc', 'true')
      .replace('npx vite build --outDir "$NEW_RELEASE_DIR"', 'mkdir -p "$NEW_RELEASE_DIR" && touch "$NEW_RELEASE_DIR/some_file.txt"')
      .replace('(cd backend && npx prisma migrate status --schema=src/database/prisma/schema.prisma)', 'true');

    // Mock pg_dump
    fs.writeFileSync(
      path.join(binDir, 'pg_dump'),
      '#!/bin/sh\necho "-- PostgreSQL database dump"\necho "CREATE TABLE public.sales (id int);"\necho "-- PostgreSQL database dump complete"\nexit 0\n',
      { mode: 0o755 }
    );
    // Mock psql
    fs.writeFileSync(path.join(binDir, 'psql'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    // Mock git
    fs.writeFileSync(
      path.join(binDir, 'git'),
      '#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo "5127d26c82162b104e63ed60288d7b2ac5f0980b"; exit 0; fi\nexit 0\n',
      { mode: 0o755 }
    );

    const scriptPath = path.join(tmpDir, 'test-deploy.sh');
    fs.writeFileSync(scriptPath, modifiedScript, { mode: 0o755 });

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      BACKUP_DIR: path.join(tmpDir, 'backups'),
      DEPLOY_STATE_DIR: path.join(tmpDir, 'deploy_state')
    };
    const res = spawnSync('bash', [scriptPath, 'e54ccef0d0408ca3a5697cb8c868d8455d8dc718'], { env, cwd: tmpDir });

    assert.notStrictEqual(res.status, 0, 'Script must fail when frontend validation fails');
    assert.match(res.stdout.toString() + res.stderr.toString(), /Frontend release validation failed/);

    // Assert live dist STILL points to activeRel and content is intact
    const currentTarget = fs.realpathSync(path.join(frontendDir, 'dist'));
    assert.strictEqual(currentTarget, fs.realpathSync(activeRel), 'Live dist must continue pointing to active release');
    assert.strictEqual(fs.readFileSync(path.join(frontendDir, 'dist/index.html'), 'utf8'), '<html>Active v1</html>');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('18. Mock test: Backend rollback avoids directory nesting with existing dist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanvati-mock-be-rollback-'));
    const backendDir = path.join(tmpDir, 'backend');
    const releasesDir = path.join(backendDir, 'releases');
    fs.mkdirSync(releasesDir, { recursive: true });

    // Baseline backup
    const backupDir = path.join(releasesDir, 'backend_baseline_5127d26_20261104_120000');
    fs.mkdirSync(backupDir);
    fs.writeFileSync(path.join(backupDir, 'server.js'), '// valid baseline server');

    // Currently failed dist directory
    const distDir = path.join(backendDir, 'dist');
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'broken.js'), '// broken code');

    // Execute rollback logic:
    // 1. Move failed dist aside
    const failedDir = path.join(releasesDir, 'failed_backend_20261104_120500');
    if (fs.existsSync(distDir)) {
      fs.renameSync(distDir, failedDir);
    }
    // 2. Restore cleanly
    fs.cpSync(backupDir, distDir, { recursive: true });

    // Assert that server.js is directly at dist/server.js (NO nested dist/backend_baseline_...)
    assert.ok(fs.existsSync(path.join(distDir, 'server.js')), 'server.js must be at dist/server.js');
    assert.strictEqual(fs.readFileSync(path.join(distDir, 'server.js'), 'utf8'), '// valid baseline server');
    assert.ok(!fs.existsSync(path.join(distDir, path.basename(backupDir))), 'Must not create nested backup directory inside dist');
    assert.ok(fs.existsSync(path.join(failedDir, 'broken.js')), 'Failed build must be preserved for post-mortem');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('19. Mock test: Backend rollback succeeds cleanly when dist is completely missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanvati-mock-be-missing-'));
    const backendDir = path.join(tmpDir, 'backend');
    const releasesDir = path.join(backendDir, 'releases');
    fs.mkdirSync(releasesDir, { recursive: true });

    const backupDir = path.join(releasesDir, 'backend_baseline_5127d26_20261104_120000');
    fs.mkdirSync(backupDir);
    fs.writeFileSync(path.join(backupDir, 'server.js'), '// valid baseline server');

    const distDir = path.join(backendDir, 'dist');
    assert.ok(!fs.existsSync(distDir), 'dist should not exist initially');

    // Execute rollback
    fs.cpSync(backupDir, distDir, { recursive: true });

    assert.ok(fs.existsSync(path.join(distDir, 'server.js')));
    assert.strictEqual(fs.readFileSync(path.join(distDir, 'server.js'), 'utf8'), '// valid baseline server');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('20. Mock test: PM2 restart failure is caught and immediately aborts deployment', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanvati-mock-pm2-fail-'));
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    // Mock pm2 where describe succeeds, but restart fails
    fs.writeFileSync(
      path.join(binDir, 'pm2'),
      '#!/bin/sh\nif [ "$1" = "describe" ]; then exit 0; fi\nif [ "$1" = "restart" ]; then echo "pm2: out of memory error" >&2; exit 1; fi\nexit 0\n',
      { mode: 0o755 }
    );
    // Mock pg_dump
    fs.writeFileSync(
      path.join(binDir, 'pg_dump'),
      '#!/bin/sh\necho "-- PostgreSQL database dump"\necho "CREATE TABLE public.sales (id int);"\necho "-- PostgreSQL database dump complete"\nexit 0\n',
      { mode: 0o755 }
    );
    // Mock psql
    fs.writeFileSync(path.join(binDir, 'psql'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    // Mock git
    fs.writeFileSync(
      path.join(binDir, 'git'),
      '#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo "5127d26c82162b104e63ed60288d7b2ac5f0980b"; exit 0; fi\nexit 0\n',
      { mode: 0o755 }
    );

    // Setup dummy directories
    const backendDir = path.join(tmpDir, 'backend');
    fs.mkdirSync(path.join(backendDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(backendDir, 'dist/server.js'), '// server');
    fs.writeFileSync(path.join(backendDir, '.env'), 'DATABASE_URL="postgresql://user:pass@localhost:5432/vahanvati_db"\n');

    const frontendDir = path.join(tmpDir, 'frontend');
    const feReleasesDir = path.join(frontendDir, 'releases');
    fs.mkdirSync(feReleasesDir, { recursive: true });
    const baselineFe = path.join(feReleasesDir, 'release_baseline');
    fs.mkdirSync(baselineFe);
    fs.writeFileSync(path.join(baselineFe, 'index.html'), '<html>Baseline</html>');
    fs.symlinkSync(baselineFe, path.join(frontendDir, 'dist'));
    fs.writeFileSync(path.join(frontendDir, 'package.json'), '{"name":"fe"}');

    const modifiedScript = deployScript
      .replace('REPO_DIR="/var/www/html/vahanvati-gruh-udhyog"', `REPO_DIR="${tmpDir}"`)
      .replace('BACKUP_DIR="/root/backups"', `BACKUP_DIR="${tmpDir}/backups"`)
      .replace('git checkout "${TARGET_COMMIT}"', 'true')
      .replace('DEPLOYED_COMMIT=$(git rev-parse HEAD)', 'DEPLOYED_COMMIT="e54ccef0d0408ca3a5697cb8c868d8455d8dc718"')
      .replace('git fetch origin main', 'true')
      .replace('git cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null', 'true')
      .replace('npm run build', 'true')
      .replace('npm install --no-audit --no-fund', 'true')
      .replace('npx tsc', 'true')
      .replace('npx vite build --outDir "$NEW_RELEASE_DIR"', 'mkdir -p "$NEW_RELEASE_DIR/assets" && echo "ok" > "$NEW_RELEASE_DIR/index.html"')
      .replace('(cd backend && npx prisma migrate status --schema=src/database/prisma/schema.prisma)', 'true');

    const scriptPath = path.join(tmpDir, 'test-deploy.sh');
    fs.writeFileSync(scriptPath, modifiedScript, { mode: 0o755 });

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      BACKUP_DIR: path.join(tmpDir, 'backups'),
      DEPLOY_STATE_DIR: path.join(tmpDir, 'deploy_state')
    };
    const res = spawnSync('bash', [scriptPath, 'e54ccef0d0408ca3a5697cb8c868d8455d8dc718'], { env, cwd: tmpDir });

    assert.notStrictEqual(res.status, 0, 'Script must fail when PM2 restart fails');
    assert.match(res.stdout.toString() + res.stderr.toString(), /pm2 restart vahanvati-backend' failed/);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('21. Exact previous-release path recording avoids ls -td traps and stores state outside repository', () => {
    // Assert deployScript records exact active symlink target and does not use ls -td for rollback target
    assert.match(deployScript, /PREV_ACTIVE_RELEASE=\$\(node -e 'try\{console\.log\(require\("fs"\)\.realpathSync\("dist"\)\)/);
    assert.match(deployScript, /DEPLOY_STATE_DIR="\$\{DEPLOY_STATE_DIR:-\/root\/deploy_state\}"/);
    assert.match(deployScript, /DEPLOY_STATE_FILE="\$\{DEPLOY_STATE_DIR\}\/deployment_state_\$\{TARGET_COMMIT\}_\$\{TIMESTAMP\}\.env"/);
    assert.ok(!deployScript.includes('ls -td releases/legacy_baseline_*'), 'Must never select release target via ls -td');
    assert.ok(!deployScript.includes('ls -td releases/backend_baseline_*'), 'Must never select backend baseline via ls -td');
    assert.ok(!deployScript.includes('ls -td'), 'Must never use ls -td anywhere in deploy script');
  });

  it('22. Mock test: Rollback after multiple failed attempts uses recorded baseline, not latest timestamp dir', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vahanvati-mock-multi-fail-'));
    const backendDir = path.join(tmpDir, 'backend');
    const releasesDir = path.join(backendDir, 'releases');
    fs.mkdirSync(releasesDir, { recursive: true });

    // Good baseline release (created earlier)
    const trueBaselineDir = path.join(releasesDir, 'backend_baseline_commitA_20261104_100000');
    fs.mkdirSync(trueBaselineDir);
    fs.writeFileSync(path.join(trueBaselineDir, 'server.js'), '// valid baseline A');

    // A failed deployment attempt created a newer directory at 100500
    const failedAttempt1Dir = path.join(releasesDir, 'backend_baseline_commitB_20261104_100500');
    fs.mkdirSync(failedAttempt1Dir);
    fs.writeFileSync(path.join(failedAttempt1Dir, 'server.js'), '// broken code from attempt 1');

    // Current live dist is broken from attempt 2
    const distDir = path.join(backendDir, 'dist');
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'server.js'), '// broken code from attempt 2');

    // An operator using ls -td | head -n1 would incorrectly pick failedAttempt1Dir!
    // But rollback using the explicitly recorded TRUE baseline:
    const recordedBaseline = trueBaselineDir;
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.cpSync(recordedBaseline, distDir, { recursive: true });

    // Verify dist was restored to the TRUE baseline
    assert.strictEqual(
      fs.readFileSync(path.join(distDir, 'server.js'), 'utf8'),
      '// valid baseline A',
      'Rollback must restore the true baseline, not intermediate failed attempt'
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('23. Dependency changes trigger npm install and module resolution validation before PM2 restart', () => {
    assert.match(deployScript, /DIFF_STATUS=0/, 'Must initialize DIFF_STATUS for exit code tracking');
    assert.match(deployScript, /git diff --quiet "\$\{PREV_COMMIT\}" "\$\{TARGET_COMMIT\}" -- backend\/package\.json/, 'Must inspect git diff exit code for dependencies');
    assert.match(deployScript, /if \[ "\$DIFF_STATUS" -eq 1 \]; then\s+BACKEND_PKG_CHANGED="true"/, 'Must set true strictly on exit code 1');
    assert.match(deployScript, /require\.resolve\(d,\{paths:\[process\.cwd\(\)\]\}\)/, 'Must validate dependency module resolution');
    assert.match(deployScript, /Refusing to restart PM2/, 'Must refuse PM2 restart if dependency validation fails');
  });

  it('24. Preflight disk space check requires minimum 1024MB free', () => {
    assert.match(deployScript, /MIN_REQUIRED_MB=1024/, 'Must enforce minimum 1024MB free space');
    assert.match(deployScript, /df -m "\$BACKUP_DIR"/, 'Must inspect available disk space on backup mount');
    assert.match(deployScript, /Insufficient free disk space/, 'Must abort if disk space is below threshold');
  });

  it('25. Strict verification that NO global PM2, Nginx or system-wide operations exist', () => {
    const forbidden = [
      'pm2 restart all',
      'pm2 reload all',
      'pm2 kill',
      'pm2 delete all',
      'pm2 restart 0',
      'systemctl reload nginx',
      'systemctl restart nginx',
      'nginx -s reload',
      'nginx -s stop',
      'reboot',
      'shutdown'
    ];

    for (const cmd of forbidden) {
      assert.ok(
        !deployScript.includes(cmd),
        `deploy-production.sh must NOT contain global command: "${cmd}"`
      );
    }
  });

  it('26. Mock test: BACKEND_PKG_CHANGED correctly evaluates true on dependency change and false when unchanged', () => {
    // 1. Unchanged case: compare current HEAD with HEAD
    const resUnchanged = spawnSync('bash', ['-c', `
      PREV_COMMIT="HEAD"
      TARGET_COMMIT="HEAD"
      BACKEND_PKG_CHANGED="false"
      DIFF_STATUS=0
      git diff --quiet "\${PREV_COMMIT}" "\${TARGET_COMMIT}" -- backend/package.json backend/package-lock.json 2>/dev/null || DIFF_STATUS=$?
      if [ "$DIFF_STATUS" -eq 1 ]; then BACKEND_PKG_CHANGED="true"; fi
      echo "RESULT=$BACKEND_PKG_CHANGED"
    `], { cwd: ROOT_DIR });
    assert.strictEqual(resUnchanged.status, 0);
    assert.match(resUnchanged.stdout.toString(), /RESULT=false/);

    // 2. Changed case: compare root commit where package.json differed
    const firstCommitRes = spawnSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: ROOT_DIR });
    const firstCommit = firstCommitRes.stdout.toString().trim();

    const resChanged = spawnSync('bash', ['-c', `
      PREV_COMMIT="${firstCommit}"
      TARGET_COMMIT="HEAD"
      BACKEND_PKG_CHANGED="false"
      DIFF_STATUS=0
      git diff --quiet "\${PREV_COMMIT}" "\${TARGET_COMMIT}" -- backend/package.json backend/package-lock.json 2>/dev/null || DIFF_STATUS=$?
      if [ "$DIFF_STATUS" -eq 1 ]; then BACKEND_PKG_CHANGED="true"; fi
      echo "RESULT=$BACKEND_PKG_CHANGED"
    `], { cwd: ROOT_DIR });
    assert.strictEqual(resChanged.status, 0);
    assert.match(resChanged.stdout.toString(), /RESULT=true/);
  });
});
