/**
 * GDPR Compliance: Cleanup Deleted Users After Database Restoration
 *
 * This script should be run AFTER restoring a database from backup to ensure
 * that users who requested deletion remain deleted (GDPR "right to be forgotten").
 *
 * Usage:
 *   pnpm exec tsx src/scripts/cleanup-deleted-users.ts
 *
 * Recommended: Run automatically after any backup restoration
 */

import { db } from '../db/index.js';

async function cleanupDeletedUsers() {
  console.log('🧹 Starting GDPR compliance cleanup...');
  console.log('   Checking for users who were deleted but restored from backup\n');

  try {
    // Get all users who should be deleted according to audit log
    const deletedUsers = await db
      .selectFrom('deleted_users')
      .select(['clerk_user_id', 'email', 'deleted_at', 'deleted_reason'])
      .orderBy('deleted_at', 'desc')
      .execute();

    console.log(`📋 Found ${deletedUsers.length} users in deletion audit log`);

    if (deletedUsers.length === 0) {
      console.log('✅ No users to clean up. Audit log is empty.');
      await db.destroy();
      process.exit(0);
    }

    let restoredCount = 0;
    const restoredUsers: Array<{ email: string; deleted_at: Date }> = [];

    // Check each deleted user to see if they were restored from backup
    for (const deletedUser of deletedUsers) {
      const restoredUser = await db
        .selectFrom('users')
        .select(['id', 'email'])
        .where('clerk_user_id', '=', deletedUser.clerk_user_id)
        .executeTakeFirst();

      if (restoredUser) {
        console.log(
          `  ⚠️  RESTORED USER FOUND: ${deletedUser.email} (deleted ${deletedUser.deleted_at?.toISOString() || 'unknown'})`
        );
        console.log(`      Re-deleting to maintain GDPR compliance...`);

        // Delete user again (CASCADE will remove all related data)
        await db
          .deleteFrom('users')
          .where('clerk_user_id', '=', deletedUser.clerk_user_id)
          .execute();

        restoredCount++;
        restoredUsers.push({
          email: deletedUser.email,
          deleted_at: deletedUser.deleted_at || new Date(),
        });

        console.log(`      ✅ Re-deleted successfully\n`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total users in deletion audit log: ${deletedUsers.length}`);
    console.log(`Users found restored from backup:  ${restoredCount}`);
    console.log(`Users re-deleted for compliance:   ${restoredCount}`);
    console.log('='.repeat(70) + '\n');

    if (restoredCount > 0) {
      console.log('⚠️  WARNING: Users were restored from backup!\n');
      console.log('   This indicates that the backup restoration process needs improvement.');
      console.log('   Consider one of the following solutions:\n');
      console.log('   1. Always run this cleanup script after database restoration');
      console.log('   2. Exclude deleted_users table data from backups');
      console.log('   3. Use point-in-time recovery instead of full restoration when possible\n');

      console.log('   Re-deleted users:');
      restoredUsers.forEach((user, index) => {
        console.log(
          `   ${index + 1}. ${user.email} (originally deleted: ${user.deleted_at.toLocaleDateString()})`
        );
      });
      console.log('');
    } else {
      console.log('✅ All deleted users remain deleted. Database is GDPR compliant.\n');
    }

    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await db.destroy();
    process.exit(1);
  }
}

// Run cleanup
cleanupDeletedUsers();
