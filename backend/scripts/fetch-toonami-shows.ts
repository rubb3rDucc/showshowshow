import dotenv from 'dotenv';
import { searchTMDB, getShowDetails } from '../src/lib/tmdb.js';

dotenv.config();

// Toonami shows to search for
const toonamiShows = [
  'Dragon Ball Z',
  'Sailor Moon',
  'Gundam Wing',
  'Outlaw Star',
  'Cowboy Bebop',
  'Tenchi Muyo',
  'The Big O',
  'Yu Yu Hakusho',
  'Rurouni Kenshin',
  'Naruto',
];

async function fetchToonamiShowIds() {
  console.log('🔍 Fetching Toonami show IDs from TMDB...\n');

  const results: Array<{ name: string; tmdb_id: number; title: string }> = [];

  for (const showName of toonamiShows) {
    try {
      const searchResults = await searchTMDB(showName, 1);
      const tvResults = searchResults.results.filter((r) => r.media_type === 'tv');

      if (tvResults.length > 0) {
        const bestMatch = tvResults[0];
        const details = await getShowDetails(bestMatch.id);

        results.push({
          name: showName,
          tmdb_id: details.id,
          title: details.name,
        });

        console.log(`✅ ${showName}: ${details.name} (ID: ${details.id})`);
      } else {
        console.log(`❌ ${showName}: Not found`);
      }

      // Rate limiting - wait a bit between requests
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`❌ Error fetching ${showName}:`, error);
    }
  }

  console.log('\n📋 Results:');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

fetchToonamiShowIds().catch(console.error);


