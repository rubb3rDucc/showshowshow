/**
 * Make a user an admin
 *
 * NOTE: This script is deprecated with Clerk Auth.
 *
 * To make a user an admin with Clerk:
 * 1. Go to https://dashboard.clerk.com
 * 2. Navigate to Users
 * 3. Select the user you want to make an admin
 * 4. Click "Edit Public Metadata"
 * 5. Add: { "isAdmin": true }
 * 6. Save changes
 *
 * The webhook will automatically sync this to the database.
 *
 * To verify admin status in the database:
 *   SELECT email, is_admin FROM users WHERE clerk_user_id = 'user_xxxxx';
 */

console.log('\n⚠️  This script is deprecated with Clerk Auth.\n');
console.log('To make a user an admin:');
console.log('1. Go to https://dashboard.clerk.com');
console.log('2. Navigate to Users → Select user → Edit Public Metadata');
console.log('3. Add: { "isAdmin": true }');
console.log('4. Save changes\n');
console.log('The webhook will automatically sync to the database.\n');

process.exit(0);
