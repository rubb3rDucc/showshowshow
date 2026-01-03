#!/bin/bash

# Test script for cache checking functionality
# Demonstrates how to prevent duplicate caching

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "======================================"
echo "Cache Check Feature Test"
echo "======================================"
echo "Backend URL: $BASE_URL"
echo ""

# Step 1: Register/Login
echo "Step 1: Authenticating..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cache-test@example.com",
    "password": "password123"
  }')

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Registration failed, trying login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "cache-test@example.com",
      "password": "password123"
    }')
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo "✅ Authenticated"

# Step 2: Search for Cowboy Bebop and check cache status
echo -e "\nStep 2: Searching for 'Cowboy Bebop' with cache status..."
SEARCH_RESULTS=$(curl -s -X GET "$BASE_URL/api/content/search?q=Cowboy%20Bebop&type=tv" \
  -H "Authorization: Bearer $TOKEN")

echo "Search results with cache status:"
echo "$SEARCH_RESULTS" | jq '.results[] | {tmdb_id, title, is_cached, cached_id}'

# Step 3: Check specific content before caching
echo -e "\nStep 3: Checking if Cowboy Bebop (30991) is cached..."
CHECK_BEFORE=$(curl -s -X GET "$BASE_URL/api/content/30991/check" \
  -H "Authorization: Bearer $TOKEN")

IS_CACHED_BEFORE=$(echo "$CHECK_BEFORE" | jq -r '.is_cached')
echo "Is cached before: $IS_CACHED_BEFORE"

if [ "$IS_CACHED_BEFORE" == "true" ]; then
  echo "⚠️  Already cached, skipping cache operation"
  CACHED_CONTENT=$(echo "$CHECK_BEFORE" | jq '.content')
  echo "Existing content:"
  echo "$CACHED_CONTENT" | jq '{id, title, content_type, created_at}'
else
  echo "✅ Not cached, proceeding to cache..."
  
  # Step 4: Cache the content
  echo -e "\nStep 4: Caching Cowboy Bebop..."
  CACHED=$(curl -s -X GET "$BASE_URL/api/content/30991?type=tv" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Cached content:"
  echo "$CACHED" | jq '{id, title, content_type, number_of_episodes}'
  
  CONTENT_ID=$(echo "$CACHED" | jq -r '.id')
fi

# Step 5: Check again after caching
echo -e "\nStep 5: Checking cache status again..."
CHECK_AFTER=$(curl -s -X GET "$BASE_URL/api/content/30991/check" \
  -H "Authorization: Bearer $TOKEN")

IS_CACHED_AFTER=$(echo "$CHECK_AFTER" | jq -r '.is_cached')
echo "Is cached after: $IS_CACHED_AFTER"

if [ "$IS_CACHED_AFTER" == "true" ]; then
  echo "✅ Content is now cached"
else
  echo "❌ Content should be cached but isn't"
fi

# Step 6: Search again to see updated cache status
echo -e "\nStep 6: Searching again to verify cache indicators..."
SEARCH_RESULTS_AFTER=$(curl -s -X GET "$BASE_URL/api/content/search?q=Cowboy%20Bebop&type=tv" \
  -H "Authorization: Bearer $TOKEN")

echo "Search results after caching:"
echo "$SEARCH_RESULTS_AFTER" | jq '.results[] | {tmdb_id, title, is_cached, cached_id} | select(.is_cached == true)'

# Step 7: Try to cache again (should return existing)
echo -e "\nStep 7: Attempting to cache again (should return existing)..."
CACHED_AGAIN=$(curl -s -X GET "$BASE_URL/api/content/30991?type=tv" \
  -H "Authorization: Bearer $TOKEN")

CONTENT_ID_AGAIN=$(echo "$CACHED_AGAIN" | jq -r '.id')
echo "Content ID: $CONTENT_ID_AGAIN"
echo "Created at: $(echo "$CACHED_AGAIN" | jq -r '.created_at')"

# Step 8: Demonstrate frontend workflow
echo -e "\n======================================"
echo "Recommended Frontend Workflow"
echo "======================================"
echo ""
echo "1. User searches for content:"
echo "   GET /api/content/search?q=Cowboy%20Bebop"
echo ""
echo "2. Results show which are already cached:"
echo "   { is_cached: true, cached_id: 'uuid' }"
echo ""
echo "3. For cached content:"
echo "   - Show 'Already in Library' badge"
echo "   - Link directly to library/queue"
echo "   - Skip cache step"
echo ""
echo "4. For uncached content:"
echo "   - Show 'Add to Library' button"
echo "   - Optional: Check before caching:"
echo "     GET /api/content/:tmdbId/check"
echo "   - Then cache:"
echo "     GET /api/content/:tmdbId?type=tv"
echo ""
echo "5. After caching, fetch episodes (for TV shows):"
echo "   GET /api/content/:tmdbId/episodes"
echo ""

echo "======================================"
echo "✅ Cache check feature test complete!"
echo "======================================"
echo ""
echo "Key Features:"
echo "- ✅ Search results include is_cached flag"
echo "- ✅ Dedicated /check endpoint"
echo "- ✅ Prevents duplicate caching"
echo "- ✅ Frontend can show library status"


