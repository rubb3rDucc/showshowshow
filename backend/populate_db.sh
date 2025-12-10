#!/bin/bash

# ShowShowShow API Test Script
# Run these commands to populate your Supabase database

# Set your backend URL (change if deployed)
BASE_URL="http://localhost:3000"

echo "======================================"
echo "ShowShowShow - Database Population"
echo "======================================"

# 1. Register a new user
echo -e "\n1. Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "toonami@test.com",
    "password": "password123"
  }')

echo "$REGISTER_RESPONSE" | jq '.'

# Extract token
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
echo "✅ Token: $TOKEN"

# 2. Login (alternative to register)
echo -e "\n2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "toonami@test.com",
    "password": "password123"
  }')

# Use login token if register failed
if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
  echo "Using login token: $TOKEN"
fi

# 3. Get current user info
echo -e "\n3. Getting current user..."
curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 4. Search and cache shows
echo -e "\n4. Searching for Dragon Ball Z..."
curl -s -X GET "$BASE_URL/api/content/search?q=Dragon%20Ball%20Z" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n5. Caching Dragon Ball Z (TMDB ID: 12609)..."
DBZ_RESPONSE=$(curl -s -X GET "$BASE_URL/api/content/12609" \
  -H "Authorization: Bearer $TOKEN")
echo "$DBZ_RESPONSE" | jq '.'
DBZ_CONTENT_ID=$(echo "$DBZ_RESPONSE" | jq -r '.id')
echo "✅ DBZ Content ID: $DBZ_CONTENT_ID"

echo -e "\n6. Fetching DBZ episodes..."
curl -s -X GET "$BASE_URL/api/content/12609/episodes" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

echo -e "\n7. Caching Sailor Moon (TMDB ID: 572)..."
SM_RESPONSE=$(curl -s -X GET "$BASE_URL/api/content/572" \
  -H "Authorization: Bearer $TOKEN")
echo "$SM_RESPONSE" | jq '.'
SM_CONTENT_ID=$(echo "$SM_RESPONSE" | jq -r '.id')
echo "✅ Sailor Moon Content ID: $SM_CONTENT_ID"

echo -e "\n8. Fetching Sailor Moon episodes..."
curl -s -X GET "$BASE_URL/api/content/572/episodes" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

echo -e "\n9. Caching Cowboy Bebop (TMDB ID: 1043)..."
BEBOP_RESPONSE=$(curl -s -X GET "$BASE_URL/api/content/1043" \
  -H "Authorization: Bearer $TOKEN")
echo "$BEBOP_RESPONSE" | jq '.'
BEBOP_CONTENT_ID=$(echo "$BEBOP_RESPONSE" | jq -r '.id')
echo "✅ Cowboy Bebop Content ID: $BEBOP_CONTENT_ID"

echo -e "\n10. Fetching Cowboy Bebop episodes..."
curl -s -X GET "$BASE_URL/api/content/1043/episodes" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

echo -e "\n11. Caching The Matrix (TMDB ID: 603)..."
MATRIX_RESPONSE=$(curl -s -X GET "$BASE_URL/api/content/603" \
  -H "Authorization: Bearer $TOKEN")
echo "$MATRIX_RESPONSE" | jq '.'
MATRIX_CONTENT_ID=$(echo "$MATRIX_RESPONSE" | jq -r '.id')
echo "✅ The Matrix Content ID: $MATRIX_CONTENT_ID"

# 5. Add items to queue
echo -e "\n12. Adding Dragon Ball Z to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$DBZ_CONTENT_ID\"}" | jq '.'

echo -e "\n13. Adding Sailor Moon to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$SM_CONTENT_ID\"}" | jq '.'

echo -e "\n14. Adding Cowboy Bebop to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$BEBOP_CONTENT_ID\"}" | jq '.'

# 6. View queue
echo -e "\n15. Viewing queue..."
curl -s -X GET "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 7. Generate schedule
echo -e "\n16. Generating schedule from queue..."
SCHEDULE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/schedule/generate/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-15",
    "end_date": "2024-12-15",
    "start_time": "18:00",
    "end_time": "23:00",
    "rotation_type": "round_robin"
  }')
echo "$SCHEDULE_RESPONSE" | jq '.'
echo "✅ Generated $(echo "$SCHEDULE_RESPONSE" | jq 'length') schedule items"

# 8. View schedule
echo -e "\n17. Viewing schedule for 2024-12-15..."
curl -s -X GET "$BASE_URL/api/schedule/date/2024-12-15" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 9. View library
echo -e "\n18. Viewing content library..."
curl -s -X GET "$BASE_URL/api/content/library" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n======================================"
echo "✅ Database populated successfully!"
echo "======================================"
echo ""
echo "Summary:"
echo "- User created: toonami@test.com"
echo "- Shows cached: Dragon Ball Z, Sailor Moon, Cowboy Bebop"
echo "- Movie cached: The Matrix"
echo "- Queue populated with 3 shows"
echo "- Schedule generated for 2024-12-15"
echo ""
echo "Your Supabase database is now populated with test data!"