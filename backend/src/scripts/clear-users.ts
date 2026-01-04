import { db } from '../db/index.js';

async function clearUsers() {
  try {
    console.log('Deleting all users and related data...');
    
    // Delete in order to respect foreign key constraints
    await db.deleteFrom('schedule').execute();
    await db.deleteFrom('watch_history').execute();
    await db.deleteFrom('library_episode_status').execute();
    await db.deleteFrom('user_library').execute();
    await db.deleteFrom('queue').execute();
    await db.deleteFrom('user_preferences').execute();
    await db.deleteFrom('users').execute();
    
    console.log('✓ All users and related data deleted successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing users:', error);
    process.exit(1);
  }
}

clearUsers();
