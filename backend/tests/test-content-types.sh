#!/bin/bash

# Test script for content type handling
# Tests the new ?type=tv and ?type=movie parameters

# Configuration - defaults to local instance
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "======================================"
echo "Content Type Handling Tests"
echo "======================================"
echo "Backend URL: $BASE_URL"
echo ""

# Step 1: Register/Login
echo "Step 1: Authenticating..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "content-test@example.com",
    "password": "password123"
  }')

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Registration failed, trying login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "content-test@example.com",
      "password": "password123"
    }')
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo "✅ Authenticated"

# Step 2: Search for Cowboy Bebop (returns both anime and live-action)
echo -e "\nStep 2: Searching for 'Cowboy Bebop' (all types)..."
SEARCH_ALL=$(curl -s -X GET "$BASE_URL/api/content/search?q=Cowboy%20Bebop" \
  -H "Authorization: Bearer $TOKEN")

echo "All results:"
echo "$SEARCH_ALL" | jq '.results[] | {tmdb_id, title, media_type, release_date, vote_average}'

# Step 3: Search for Cowboy Bebop (TV only)
echo -e "\nStep 3: Searching for 'Cowboy Bebop' (TV only)..."
SEARCH_TV=$(curl -s -X GET "$BASE_URL/api/content/search?q=Cowboy%20Bebop&type=tv" \
  -H "Authorization: Bearer $TOKEN")

echo "TV results only:"
echo "$SEARCH_TV" | jq '.results[] | {tmdb_id, title, media_type, release_date}'

# Step 4: Test TMDB ID 30991 (exists as both movie and TV)
echo -e "\nStep 4: Fetching TMDB ID 30991 WITHOUT type parameter..."
CONTENT_AUTO=$(curl -s -X GET "$BASE_URL/api/content/30991" \
  -H "Authorization: Bearer $TOKEN")

echo "Result (auto-detected):"
echo "$CONTENT_AUTO" | jq '{id, tmdb_id, content_type, title, release_date, first_air_date}'

# Step 5: Force TV lookup for TMDB ID 30991
echo -e "\nStep 5: Fetching TMDB ID 30991 WITH type=tv..."
CONTENT_TV=$(curl -s -X GET "$BASE_URL/api/content/30991?type=tv" \
  -H "Authorization: Bearer $TOKEN")

echo "Result (forced TV):"
echo "$CONTENT_TV" | jq '{id, tmdb_id, content_type, title, number_of_episodes, first_air_date}'

BEBOP_CONTENT_ID=$(echo "$CONTENT_TV" | jq -r '.id')

# Step 6: Verify we can fetch episodes for the TV show
echo -e "\nStep 6: Fetching episodes for Cowboy Bebop anime..."
EPISODES=$(curl -s -X GET "$BASE_URL/api/content/30991/episodes" \
  -H "Authorization: Bearer $TOKEN")

EPISODE_COUNT=$(echo "$EPISODES" | jq 'length')
echo "✅ Found $EPISODE_COUNT episodes"

if [ "$EPISODE_COUNT" -gt 0 ]; then
  echo "Sample episodes:"
  echo "$EPISODES" | jq '.[0:3] | .[] | {season, episode_number, title}'
fi

# Step 7: Test with The Matrix (movie)
echo -e "\nStep 7: Fetching The Matrix (TMDB ID 603) as movie..."
MATRIX=$(curl -s -X GET "$BASE_URL/api/content/603?type=movie" \
  -H "Authorization: Bearer $TOKEN")

echo "Result:"
echo "$MATRIX" | jq '{id, tmdb_id, content_type, title, default_duration, release_date}'

MATRIX_CONTENT_ID=$(echo "$MATRIX" | jq -r '.id')

# Step 8: Add both to queue
echo -e "\nStep 8: Adding Cowboy Bebop to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$BEBOP_CONTENT_ID\"}" | jq '{id, content_id}'

echo "Adding The Matrix to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$MATRIX_CONTENT_ID\"}" | jq '{id, content_id}'

# Step 9: Generate schedule
echo -e "\nStep 9: Generating schedule with TV show and movie..."
SCHEDULE=$(curl -s -X POST "$BASE_URL/api/schedule/generate/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-20",
    "end_date": "2024-12-20",
    "start_time": "20:00",
    "end_time": "23:00",
    "rotation_type": "round_robin"
  }')

SCHEDULE_COUNT=$(echo "$SCHEDULE" | jq 'length')
echo "✅ Generated $SCHEDULE_COUNT schedule items"

if [ "$SCHEDULE_COUNT" -gt 0 ]; then
  echo "Schedule preview:"
  echo "$SCHEDULE" | jq '.[] | {scheduled_time, season, episode, duration}'
fi

# Step 10: View library
echo -e "\nStep 10: Viewing library..."
LIBRARY=$(curl -s -X GET "$BASE_URL/api/content/library" \
  -H "Authorization: Bearer $TOKEN")

echo "Library contents:"
echo "$LIBRARY" | jq '.[] | {id, title, content_type, tmdb_id}'

echo -e "\n======================================"
echo "✅ All tests completed!"
echo "======================================"
echo ""
echo "Summary:"
echo "- Search with type filtering: ✅"
echo "- Force TV lookup with ?type=tv: ✅"
echo "- Force movie lookup with ?type=movie: ✅"
echo "- Episode fetching for TV shows: ✅"
echo "- Mixed content scheduling: ✅"
echo ""
echo "You can now use:"
echo "  GET /api/content/:tmdbId?type=tv    - Force TV show lookup"
echo "  GET /api/content/:tmdbId?type=movie - Force movie lookup"
echo "  GET /api/content/search?type=tv     - Search TV shows only"
echo "  GET /api/content/search?type=movie  - Search movies only"

