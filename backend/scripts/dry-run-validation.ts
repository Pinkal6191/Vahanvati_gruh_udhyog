import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function dryRunSqlValidation() {
  console.log('🧪 Starting Dry-Run Transactional Validation of production-master-data.sql...');

  const sqlPath = path.resolve(process.cwd(), '../docs/production-master-data.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Parse statements (ignore comments and empty lines)
  const statements: string[] = [];
  const rawLines = sqlContent.split('\n');
  let currentStmt = '';

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    if (trimmed === 'BEGIN;' || trimmed === 'COMMIT;') continue;

    currentStmt += ' ' + trimmed;
    if (trimmed.endsWith(';')) {
      statements.push(currentStmt.trim());
      currentStmt = '';
    }
  }

  console.log(`Parsed ${statements.length} SQL statements to execute.`);

  let executedCount = 0;
  try {
    await prisma.$transaction(async (tx) => {
      for (const stmt of statements) {
        // Execute without trailing semicolon if needed
        const cleanStmt = stmt.endsWith(';') ? stmt.slice(0, -1) : stmt;
        await tx.$executeRawUnsafe(cleanStmt);
        executedCount++;
      }
      throw new Error('ROLLBACK_INTENTIONAL_DRY_RUN_COMPLETED');
    });
  } catch (err: any) {
    if (err.message === 'ROLLBACK_INTENTIONAL_DRY_RUN_COMPLETED') {
      console.log(`✅ Successfully executed and validated ALL ${executedCount} statements!`);
      console.log('🛡️ Transaction rolled back completely. ZERO rows modified.');
    } else {
      console.error(`❌ Validation failed at statement #${executedCount + 1}:`, err);
      throw err;
    }
  }

  await prisma.$disconnect();
}

dryRunSqlValidation().catch(async (e) => {
  await prisma.$disconnect();
  process.exit(1);
});
