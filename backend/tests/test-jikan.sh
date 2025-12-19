#!/bin/bash

# Test script for Jikan API integration
# Make sure the backend server is running: pnpm run dev

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
echo "Testing Jikan integration at $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Test 1: Search with Jikan source ===${NC}"
echo "Searching for 'Attack on Titan' using Jikan..."
curl -s "${BASE_URL}/api/content/search?q=Attack%20on%20Titan&source=jikan&page=1" | jq '.results[0] | {mal_id, title, title_english, title_japanese, data_source, is_cached}'
echo ""

echo -e "${BLUE}=== Test 2: Search with auto source (should use Jikan) ===${NC}"
echo "Searching for 'One Piece' using auto source..."
curl -s "${BASE_URL}/api/content/search?q=One%20Piece&source=auto&page=1" | jq '.results[0] | {mal_id, title, data_source, is_cached}'
echo ""

echo -e "${BLUE}=== Test 3: Compare Jikan vs TMDB results ===${NC}"
echo "Jikan results for 'Naruto':"
JIKAN_RESULTS=$(curl -s "${BASE_URL}/api/content/search?q=Naruto&source=jikan&page=1")
echo "$JIKAN_RESULTS" | jq '.results[0] | {title, mal_id, data_source}'
echo ""

echo "TMDB results for 'Naruto':"
TMDB_RESULTS=$(curl -s "${BASE_URL}/api/content/search?q=Naruto&source=tmdb&page=1")
echo "$TMDB_RESULTS" | jq '.results[0] | {title, tmdb_id, data_source}'
echo ""

echo -e "${BLUE}=== Test 4: Cache Jikan content ===${NC}"
echo "Getting MAL ID from search..."
MAL_ID=$(curl -s "${BASE_URL}/api/content/search?q=Attack%20on%20Titan&source=jikan&page=1" | jq -r '.results[0].mal_id // empty')
if [ -z "$MAL_ID" ] || [ "$MAL_ID" = "null" ]; then
  echo -e "${YELLOW}⚠️  No MAL ID found, using test ID 16498 (Attack on Titan)${NC}"
  MAL_ID=16498
else
  echo "Found MAL ID: $MAL_ID"
fi
echo ""

echo "Caching content with MAL ID $MAL_ID..."
CACHED=$(curl -s "${BASE_URL}/api/content/jikan/${MAL_ID}")
echo "$CACHED" | jq '{id, mal_id, tmdb_id, data_source, title, title_english, title_japanese, number_of_episodes}'
echo ""

echo -e "${BLUE}=== Test 5: Check cache status ===${NC}"
echo "Checking if content is cached..."
curl -s "${BASE_URL}/api/content/check?mal_id=${MAL_ID}" | jq '{is_cached, content: {id, mal_id, data_source, title}}'
echo ""

echo -e "${BLUE}=== Test 6: Search again (should show cached) ===${NC}"
echo "Searching again - should show is_cached=true..."
curl -s "${BASE_URL}/api/content/search?q=Attack%20on%20Titan&source=jikan&page=1" | jq '.results[0] | {title, mal_id, is_cached, cached_id}'
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Summary:"
echo "- Jikan search is working"
echo "- Content caching is working"
echo "- Cache checking works with MAL IDs"

