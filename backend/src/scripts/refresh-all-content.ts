import { db } from '../db/index.js';
import { getShowDetails, getMovieDetails, getShowContentRatings, getMovieReleaseDates, extractUSRating, getImageUrl, getDefaultDuration } from '../lib/tmdb.js';
import { getAnimeDetails, jikanToContentFormat } from '../lib/jikan.js';
import { normalizeRating } from '../lib/rating-utils.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FAILED_CONTENT_FILE = path.join(__dirname, '../../failed-refresh-content.json');

/**
 * Refresh all content in the database to get ratings
 * This will re-fetch from TMDB/Jikan and update the rating field
 * 
 * Usage:
 *   tsx src/scripts/refresh-all-content.ts          # Refresh all content (skips items that already have ratings)
 *   tsx src/scripts/refresh-all-content.ts --force # Force refresh all content
 *   tsx src/scripts/refresh-all-content.ts --retry # Retry only failed items
 */
async function refreshAllContent() {
  const retryFailed = process.argv.includes('--retry');
  const forceRefresh = process.argv.includes('--force');
  
  if (retryFailed) {
    console.log('🔄 Retrying failed content refreshes...');
  } else if (forceRefresh) {
    console.log('🔄 Force refreshing all content (including items with existing ratings)...');
  } else {
    console.log('🔄 Refreshing content missing ratings...');
  }

  try {
    let allContent;
    let failedContentIds: string[] = [];

    if (retryFailed) {
      // Load failed content IDs from file
      try {
        const failedData = await fs.readFile(FAILED_CONTENT_FILE, 'utf-8');
        failedContentIds = JSON.parse(failedData);
        console.log(`Found ${failedContentIds.length} failed items to retry\n`);
        
        if (failedContentIds.length === 0) {
          console.log('✅ No failed items to retry!');
          return;
        }

        allContent = await db
          .selectFrom('content')
          .selectAll()
          .where('id', 'in', failedContentIds)
          .execute();
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          console.log('ℹ️  No failed items file found. Run without --retry first.');
          return;
        }
        throw error;
      }
    } else {
      // Get content - skip items that already have ratings unless force refresh
      if (forceRefresh) {
        allContent = await db
          .selectFrom('content')
          .selectAll()
          .execute();
      } else {
        // Only get content that's missing ratings or other key data
        allContent = await db
          .selectFrom('content')
          .selectAll()
          .where((eb) => 
            eb.or([
              eb('rating', 'is', null),
              eb('rating', '=', ''),
              eb('poster_url', 'is', null),
              eb('overview', 'is', null),
            ])
          )
          .execute();
      }
    }

    if (allContent.length === 0) {
      console.log('✅ All content already has ratings and data! Nothing to refresh.');
      if (!forceRefresh && !retryFailed) {
        console.log('   Use --force to refresh all content anyway.');
      }
      return;
    }

    console.log(`Found ${allContent.length} content items to refresh\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const newFailedIds: string[] = [];

    for (const content of allContent) {
      try {
        // Check if content already has all necessary data (unless force refresh)
        if (!forceRefresh && !retryFailed && content.rating && content.poster_url && content.overview) {
          console.log(`⏭️  Skipping ${content.title} - already has rating and data`);
          skipped++;
          continue;
        }

        let rating: string | null = null;
        let updateData: any = { updated_at: new Date() };

        if (content.data_source === 'jikan' && content.mal_id) {
          console.log(`Refreshing Jikan content: ${content.title} (MAL ID: ${content.mal_id})`);
          
          let jikanAnime;
          let retries = 0;
          const maxRetries = 3;
          
          while (retries < maxRetries) {
            try {
              jikanAnime = await getAnimeDetails(content.mal_id);
              break;
            } catch (error: any) {
              if (error.message?.includes('rate limit')) {
                retries++;
                if (retries < maxRetries) {
                  const waitTime = 5000 * retries; // Exponential backoff: 5s, 10s, 15s
                  console.log(`  ⏳ Rate limited, waiting ${waitTime}ms before retry ${retries}/${maxRetries}...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                }
              }
              throw error;
            }
          }
          
          const contentData = jikanToContentFormat(jikanAnime);
          rating = normalizeRating(contentData.rating);
          
          updateData = {
            title: contentData.title,
            title_english: contentData.title_english,
            title_japanese: contentData.title_japanese,
            overview: contentData.overview,
            poster_url: contentData.poster_url,
            backdrop_url: contentData.backdrop_url,
            release_date: contentData.release_date,
            first_air_date: contentData.first_air_date,
            default_duration: contentData.default_duration,
            number_of_episodes: contentData.number_of_episodes,
            number_of_seasons: contentData.number_of_seasons,
            status: contentData.status,
            rating: rating,
            updated_at: new Date(),
          };
        } else if (content.tmdb_id) {
          console.log(`Refreshing TMDB content: ${content.title} (TMDB ID: ${content.tmdb_id})`);
          
          if (content.content_type === 'show') {
            const show = await getShowDetails(content.tmdb_id);
            try {
              const contentRatings = await getShowContentRatings(content.tmdb_id);
              rating = normalizeRating(extractUSRating(contentRatings, 'show'));
            } catch (error) {
              console.warn(`  ⚠️  Failed to fetch ratings: ${error}`);
            }

            updateData = {
              title: show.name,
              overview: show.overview,
              poster_url: getImageUrl(show.poster_path),
              backdrop_url: getImageUrl(show.backdrop_path, 'w780'),
              first_air_date: show.first_air_date ? new Date(show.first_air_date) : null,
              last_air_date: show.last_air_date ? new Date(show.last_air_date) : null,
              default_duration: getDefaultDuration(show, 'show'),
              number_of_seasons: show.number_of_seasons,
              number_of_episodes: show.number_of_episodes,
              status: show.status,
              rating: rating,
              updated_at: new Date(),
            };
          } else {
            const movie = await getMovieDetails(content.tmdb_id);
            try {
              const releaseDates = await getMovieReleaseDates(content.tmdb_id);
              rating = normalizeRating(extractUSRating(releaseDates, 'movie'));
            } catch (error) {
              console.warn(`  ⚠️  Failed to fetch ratings: ${error}`);
            }

            updateData = {
              title: movie.title,
              overview: movie.overview,
              poster_url: getImageUrl(movie.poster_path),
              backdrop_url: getImageUrl(movie.backdrop_path, 'w780'),
              release_date: movie.release_date ? new Date(movie.release_date) : null,
              default_duration: getDefaultDuration(movie, 'movie'),
              rating: rating,
              updated_at: new Date(),
            };
          }
        } else {
          console.log(`⚠️  Skipping ${content.title} - no valid source ID`);
          failed++;
          continue;
        }

        await db
          .updateTable('content')
          .set(updateData)
          .where('id', '=', content.id)
          .execute();

        console.log(`  ✅ Updated${rating ? ` (Rating: ${rating})` : ' (No rating available)'}`);
        updated++;

        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to refresh ${content.title}:`, errorMsg);
        failed++;
        newFailedIds.push(content.id);
      }
    }

    // Save failed IDs to file (only if not retrying)
    if (!retryFailed && newFailedIds.length > 0) {
      await fs.writeFile(FAILED_CONTENT_FILE, JSON.stringify(newFailedIds, null, 2), 'utf-8');
      console.log(`\n📝 Saved ${newFailedIds.length} failed content IDs to ${FAILED_CONTENT_FILE}`);
      console.log(`   Run with --retry flag to retry only failed items`);
    } else if (retryFailed && newFailedIds.length === 0) {
      // All retries succeeded, remove the file
      try {
        await fs.unlink(FAILED_CONTENT_FILE);
        console.log(`\n✅ All retries succeeded! Removed failed items file.`);
      } catch (error) {
        // File might not exist, that's okay
      }
    } else if (retryFailed && newFailedIds.length > 0) {
      // Some retries still failed, update the file
      await fs.writeFile(FAILED_CONTENT_FILE, JSON.stringify(newFailedIds, null, 2), 'utf-8');
      console.log(`\n📝 Updated failed items file with ${newFailedIds.length} remaining failures`);
    }

    console.log(`\n✅ Refresh complete!`);
    console.log(`   Updated: ${updated}`);
    if (skipped > 0) {
      console.log(`   Skipped: ${skipped} (already had data)`);
    }
    console.log(`   Failed: ${failed}`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

refreshAllContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

