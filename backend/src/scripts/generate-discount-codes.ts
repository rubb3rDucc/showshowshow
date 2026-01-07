import { db } from '../db/index.js';
import { sql } from 'kysely';
import * as readline from 'readline';

/**
 * Generate discount codes for waitlist members
 * 
 * Usage:
 *   tsx src/scripts/generate-discount-codes.ts
 *   tsx src/scripts/generate-discount-codes.ts --first-100  # First 100 signups
 *   tsx src/scripts/generate-discount-codes.ts --all        # Everyone
 *   tsx src/scripts/generate-discount-codes.ts --count 50   # First 50
 */

function generateCode(prefix: string = 'BETA2024'): string {
  // Generate something like "BETA2024-ABC123"
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

async function checkCodeUnique(code: string): Promise<boolean> {
  const existing = await db
    .selectFrom('waitlist')
    .select('id')
    .where('discount_code', '=', code)
    .executeTakeFirst();
  
  return !existing;
}

async function generateCodes(limit?: number, prefix?: string) {
  const codePrefix = prefix || 'BETA2024';
  
  let query = db
    .selectFrom('waitlist')
    .selectAll()
    .where('discount_code', 'is', null) // Only those without codes
    .orderBy('created_at', 'asc'); // Oldest first

  const entries = limit 
    ? await query.limit(limit).execute()
    : await query.execute();

  if (entries.length === 0) {
    console.log('✅ All waitlist members already have discount codes!');
    await db.destroy();
    process.exit(0);
  }

  console.log(`📧 Generating codes for ${entries.length} waitlist members...`);
  console.log(`   Using prefix: ${codePrefix}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const entry of entries) {
    let code = generateCode(codePrefix);
    let attempts = 0;
    const maxAttempts = 10;
    
    // Ensure unique code
    while (!(await checkCodeUnique(code)) && attempts < maxAttempts) {
      code = generateCode(codePrefix);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.error(`❌ Failed to generate unique code for ${entry.email} after ${maxAttempts} attempts`);
      errorCount++;
      continue;
    }

    try {
      await db
        .updateTable('waitlist')
        .set({
          discount_code: code,
          updated_at: new Date(),
        })
        .where('id', '=', entry.id)
        .execute();

      console.log(`✅ Generated code ${code} for ${entry.email}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error updating ${entry.email}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  if (errorCount > 0) {
    console.log(`   ❌ Errors: ${errorCount}`);
  }

  console.log(`\n📋 Next steps:`);
  console.log(`   1. Export emails with codes:`);
  console.log(`      SELECT email, discount_code, created_at FROM waitlist WHERE discount_code IS NOT NULL ORDER BY created_at;`);
  console.log(`   2. Send emails with codes (via Resend, SendGrid, etc.)`);
  console.log(`   3. Mark as sent: UPDATE waitlist SET code_sent_at = NOW() WHERE discount_code IS NOT NULL AND code_sent_at IS NULL;`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let limit: number | undefined;
let prefix: string | undefined;

if (args.includes('--all')) {
  limit = undefined;
} else if (args.includes('--first-100')) {
  limit = 100;
} else {
  const countIndex = args.indexOf('--count');
  if (countIndex !== -1 && args[countIndex + 1]) {
    limit = parseInt(args[countIndex + 1], 10);
    if (isNaN(limit) || limit <= 0) {
      console.error('❌ Invalid count. Use: --count <number>');
      process.exit(1);
    }
  }
}

const prefixIndex = args.indexOf('--prefix');
if (prefixIndex !== -1 && args[prefixIndex + 1]) {
  prefix = args[prefixIndex + 1];
}

generateCodes(limit, prefix)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => db.destroy());



