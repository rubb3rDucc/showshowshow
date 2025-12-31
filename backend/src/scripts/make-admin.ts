import { db } from '../db/index.js';
import { hashPassword } from '../lib/auth.js';
import * as readline from 'readline';

/**
 * Make a user an admin or create an admin account
 * 
 * Usage:
 *   tsx src/scripts/make-admin.ts
 *   tsx src/scripts/make-admin.ts --email admin@example.com
 *   tsx src/scripts/make-admin.ts --create --email admin@example.com --password securepassword
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function makeAdmin() {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let create = false;
  let password: string | undefined;

  // Parse arguments
  const emailIndex = args.indexOf('--email');
  if (emailIndex !== -1 && args[emailIndex + 1]) {
    email = args[emailIndex + 1];
  }

  if (args.includes('--create')) {
    create = true;
  }

  const passwordIndex = args.indexOf('--password');
  if (passwordIndex !== -1 && args[passwordIndex + 1]) {
    password = args[passwordIndex + 1];
  }

  // If email not provided, ask for it
  if (!email) {
    email = await question('Enter email address: ');
  }

  if (!email || !email.includes('@')) {
    console.error('❌ Invalid email address');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists
  const existingUser = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', normalizedEmail)
    .executeTakeFirst();

  if (create) {
    if (existingUser) {
      console.error(`❌ User ${normalizedEmail} already exists`);
      process.exit(1);
    }

    // Create new admin user
    if (!password) {
      password = await question('Enter password: ');
    }

    if (!password || password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    const passwordHash = await hashPassword(password);

    const user = await db
      .insertInto('users')
      .values({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        password_hash: passwordHash,
        is_admin: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning(['id', 'email', 'is_admin'])
      .executeTakeFirst();

    console.log(`✅ Created admin user: ${user?.email}`);
    console.log(`   User ID: ${user?.id}`);
  } else {
    if (!existingUser) {
      console.error(`❌ User ${normalizedEmail} not found`);
      console.log('\n💡 To create a new admin user, use:');
      console.log(`   tsx src/scripts/make-admin.ts --create --email ${normalizedEmail} --password <password>`);
      process.exit(1);
    }

    if (existingUser.is_admin) {
      console.log(`ℹ️  User ${normalizedEmail} is already an admin`);
      process.exit(0);
    }

    // Make existing user admin
    await db
      .updateTable('users')
      .set({
        is_admin: true,
        updated_at: new Date(),
      })
      .where('id', '=', existingUser.id)
      .execute();

    console.log(`✅ Made ${normalizedEmail} an admin`);
  }

  rl.close();
  await db.destroy();
  process.exit(0);
}

makeAdmin().catch((error) => {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
});

