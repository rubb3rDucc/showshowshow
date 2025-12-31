import { db } from '../db/index.js';
import { getNetworkDetails } from '../lib/tmdb.js';
import { FEATURED_NETWORKS } from '../lib/networks.js';

async function seedNetworks() {
  console.log('🌱 Seeding networks...');
  
  let successCount = 0;
  let failureCount = 0;

  for (const network of FEATURED_NETWORKS) {
    try {
      console.log(`📡 Fetching ${network.name}...`);
      const details = await getNetworkDetails(network.tmdb_id);
      
      // Get the highest sort_order
      const maxSortOrder = await db
        .selectFrom('networks')
        .select(db.fn.max('sort_order').as('max_sort'))
        .executeTakeFirst();
      
      await db
        .insertInto('networks')
        .values({
          id: crypto.randomUUID(),
          tmdb_network_id: details.id,
          name: details.name,
          logo_path: details.logo_path,
          origin_country: details.origin_country,
          sort_order: (maxSortOrder?.max_sort ?? -1) + 1,
          is_provider: false, // Featured networks are TV networks, not providers
          created_at: new Date(),
        })
        .onConflict((oc) => 
          oc.column('tmdb_network_id').doUpdateSet({
            name: details.name,
            logo_path: details.logo_path,
            origin_country: details.origin_country,
          })
        )
        .execute();
      
      console.log(`✅ ${details.name}`);
      successCount++;
      
      // Rate limit to avoid hitting TMDB API too hard
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`❌ Failed to seed ${network.name}:`, error);
      failureCount++;
    }
  }
  
  console.log(`\n✅ Networks seeded successfully!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failureCount}`);
  
  process.exit(0);
}

seedNetworks().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});

