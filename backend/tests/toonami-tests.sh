#!/bin/bash

# Toonami Show Tests
# Make sure your server is running: pnpm run dev
# Make sure you have a user account and TOKEN set

# Configuration - defaults to local instance
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Toonami Show Tests ===${NC}\n"

# Toonami Show TMDB IDs
DBZ_ID=12971
SAILOR_MOON_ID=3570
GUNDAM_WING_ID=21730
OUTLAW_STAR_ID=35106
COWBOY_BEBOP_ID=30991

# Movie TMDB IDs
MATRIX_ID=603

# Step 1: Register/Login (if not already done)
echo -e "${YELLOW}Step 1: Authentication${NC}"
echo "Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "toonami@test.com",
    "password": "password123"
  }')

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "User might already exist, trying login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "toonami@test.com",
      "password": "password123"
    }')
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token. Please check your server."
  exit 1
fi

echo -e "${GREEN}✅ Token obtained${NC}\n"

# Step 2: Fetch and cache Toonami shows
echo -e "${YELLOW}Step 2: Fetching Toonami Shows from TMDB${NC}"

echo "Fetching Dragon Ball Z..."
DBZ_CONTENT=$(curl -s -X GET "$BASE_URL/api/content/$DBZ_ID" \
  -H "Authorization: Bearer $TOKEN")
DBZ_CONTENT_ID=$(echo $DBZ_CONTENT | jq -r '.id')
echo -e "${GREEN}✅ DBZ cached: $DBZ_CONTENT_ID${NC}"

echo "Fetching Sailor Moon..."
SAILOR_MOON_CONTENT=$(curl -s -X GET "$BASE_URL/api/content/$SAILOR_MOON_ID" \
  -H "Authorization: Bearer $TOKEN")
SAILOR_MOON_CONTENT_ID=$(echo $SAILOR_MOON_CONTENT | jq -r '.id')
echo -e "${GREEN}✅ Sailor Moon cached: $SAILOR_MOON_CONTENT_ID${NC}"

echo "Fetching Gundam Wing..."
GUNDAM_CONTENT=$(curl -s -X GET "$BASE_URL/api/content/$GUNDAM_WING_ID" \
  -H "Authorization: Bearer $TOKEN")
GUNDAM_CONTENT_ID=$(echo $GUNDAM_CONTENT | jq -r '.id')
echo -e "${GREEN}✅ Gundam Wing cached: $GUNDAM_CONTENT_ID${NC}"

echo "Fetching Cowboy Bebop..."
BEBOP_CONTENT=$(curl -s -X GET "$BASE_URL/api/content/$COWBOY_BEBOP_ID" \
  -H "Authorization: Bearer $TOKEN")
BEBOP_CONTENT_ID=$(echo $BEBOP_CONTENT | jq -r '.id')
echo -e "${GREEN}✅ Cowboy Bebop cached: $BEBOP_CONTENT_ID${NC}\n"

# Helper function to delete all schedule items for a date range
delete_schedule_for_date() {
  local START_DATE=$1
  local END_DATE=${2:-$START_DATE}  # If no end date, use start date
  
  # If more than 2 arguments, use first as start and last as end
  if [ $# -gt 2 ]; then
    START_DATE=$1
    END_DATE=${!#}  # Last argument
  fi
  
  echo -e "${YELLOW}  Cleaning up schedule from $START_DATE to $END_DATE...${NC}"
  SCHEDULE_JSON=$(curl -s -X GET "$BASE_URL/api/schedule?start=$START_DATE&end=$END_DATE" \
    -H "Authorization: Bearer $TOKEN")
  
  # Check if we got valid JSON
  if ! echo "$SCHEDULE_JSON" | jq empty 2>/dev/null; then
    echo -e "${YELLOW}  ⚠️  Invalid JSON response${NC}"
    echo "  Response: $SCHEDULE_JSON" >&2
    return
  fi
  
  SCHEDULE_COUNT=$(echo "$SCHEDULE_JSON" | jq 'length // 0')
  
  if [ "$SCHEDULE_COUNT" -gt 0 ]; then
    # Extract all IDs into an array first
    SCHEDULE_IDS=($(echo "$SCHEDULE_JSON" | jq -r '.[].id | select(. != null and . != "")'))
    
    if [ ${#SCHEDULE_IDS[@]} -eq 0 ]; then
      echo -e "${YELLOW}  ⚠️  Found $SCHEDULE_COUNT items but couldn't extract IDs${NC}"
      return
    fi
    
    DELETED=0
    FAILED=0
    for SCHEDULE_ID in "${SCHEDULE_IDS[@]}"; do
      if [ -n "$SCHEDULE_ID" ] && [ "$SCHEDULE_ID" != "null" ]; then
        DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/schedule/$SCHEDULE_ID" \
          -H "Authorization: Bearer $TOKEN" 2>/dev/null)
        HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
        DELETE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')
        if [ "$HTTP_CODE" = "200" ]; then
          DELETED=$((DELETED + 1))
        else
          FAILED=$((FAILED + 1))
          echo "  ⚠️  Failed to delete schedule $SCHEDULE_ID (HTTP $HTTP_CODE)" >&2
        fi
      fi
    done
    
    if [ "$DELETED" -gt 0 ]; then
      echo -e "${GREEN}  ✅ Deleted $DELETED of ${#SCHEDULE_IDS[@]} schedule item(s)${NC}"
      if [ "$FAILED" -gt 0 ]; then
        echo -e "${YELLOW}  ⚠️  $FAILED item(s) failed to delete${NC}"
      fi
    else
      echo -e "${YELLOW}  ⚠️  No items were deleted (expected ${#SCHEDULE_IDS[@]})${NC}"
    fi
  else
    echo -e "${GREEN}  ✅ No schedule items to clean${NC}"
  fi
}

# Helper function to clear the queue
clear_queue() {
  echo -e "${YELLOW}  Clearing queue...${NC}"
  DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/queue" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}  ✅ Queue cleared${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Failed to clear queue (HTTP $HTTP_CODE)${NC}"
  fi
}

# Step 3: Add shows to queue
echo -e "${YELLOW}Step 3: Adding Shows to Queue${NC}"

echo "Adding Cowboy Bebop to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$BEBOP_CONTENT_ID\"}" | jq '.'
echo -e "${GREEN}✅ Cowboy Bebop added to queue${NC}\n"

# Step 4: Get queue
echo -e "${YELLOW}Step 4: View Queue${NC}"
curl -s -X GET "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Step 5: Fetch episodes for Cowboy Bebop (REQUIRED for schedule generation)
echo -e "${YELLOW}Step 5: Fetching Episodes (Required for Schedule Generation)${NC}"

echo "Fetching Cowboy Bebop episodes (this may take a while)..."
curl -s -X GET "$BASE_URL/api/content/$COWBOY_BEBOP_ID/episodes" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
EPISODE_COUNT=$(curl -s -X GET "$BASE_URL/api/content/$COWBOY_BEBOP_ID/episodes" \
  -H "Authorization: Bearer $TOKEN" | jq 'length')
echo -e "${GREEN}✅ Cowboy Bebop: $EPISODE_COUNT episodes cached${NC}"

# Verify queue has content
echo "Verifying queue..."
QUEUE_CONTENT=$(curl -s -X GET "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN")
QUEUE_COUNT=$(echo "$QUEUE_CONTENT" | jq 'length')
echo "Queue has $QUEUE_COUNT item(s)"
if [ "$QUEUE_COUNT" -gt 0 ]; then
  QUEUE_CONTENT_ID=$(echo "$QUEUE_CONTENT" | jq -r '.[0].content_id')
  echo "Queue content_id: $QUEUE_CONTENT_ID"
  echo "Bebop content_id: $BEBOP_CONTENT_ID"
  if [ "$QUEUE_CONTENT_ID" != "$BEBOP_CONTENT_ID" ]; then
    echo -e "${YELLOW}⚠️  Warning: Queue content_id doesn't match!${NC}"
  fi
fi
echo ""

# Step 6: Generate schedule from queue
echo -e "${YELLOW}Step 6: Generate Schedule from Queue (Cowboy Bebop)${NC}"
echo "Generating schedule for 2024-12-14 with round_robin rotation..."

SCHEDULE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/schedule/generate/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-14",
    "end_date": "2024-12-14",
    "start_time": "18:00",
    "end_time": "20:00",
    "time_slot_duration": 30,
    "max_shows_per_time_slot": 1,
    "include_reruns": false,
    "rerun_frequency": "rarely",
    "rotation_type": "round_robin"
  }')

HTTP_CODE=$(echo "$SCHEDULE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SCHEDULE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.'
else
  echo "$RESPONSE_BODY" | jq '.count'
  echo "$RESPONSE_BODY" | jq '.schedule[0:5]' # Show first 5 schedule items
  if [ "$(echo "$RESPONSE_BODY" | jq -r '.count // 0')" = "0" ]; then
    echo -e "${YELLOW}⚠️  No schedule items generated${NC}"
    echo "$RESPONSE_BODY" | jq '.message // empty'
  else
    echo -e "${GREEN}✅ Schedule generated${NC}"
  fi
fi

# Clean up after test
delete_schedule_for_date "2024-12-13" "2024-12-31"
clear_queue
echo ""

# Step 7: Generate schedule with random rotation
echo -e "${YELLOW}Step 7: Generate Schedule with Random Rotation (Cowboy Bebop)${NC}"
SCHEDULE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/schedule/generate/shows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"show_ids\": [\"$BEBOP_CONTENT_ID\"],
    \"start_date\": \"2024-12-14\",
    \"end_date\": \"2024-12-14\",
    \"start_time\": \"18:00\",
    \"end_time\": \"20:00\",
    \"rotation_type\": \"random\"
  }")

HTTP_CODE=$(echo "$SCHEDULE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SCHEDULE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.'
else
  echo "$RESPONSE_BODY" | jq '.count'
  echo "$RESPONSE_BODY" | jq '.schedule[0:5]'
  if [ "$(echo "$RESPONSE_BODY" | jq -r '.count // 0')" = "0" ]; then
    echo -e "${YELLOW}⚠️  No schedule items generated${NC}"
    echo "$RESPONSE_BODY" | jq '.message // empty'
  else
    echo -e "${GREEN}✅ Random rotation schedule generated${NC}"
  fi
fi

# Clean up after test
delete_schedule_for_date "2024-12-13" "2024-12-31"
clear_queue
echo ""

# Step 8: Generate schedule with midnight crossover (18:00 to 00:00)
echo -e "${YELLOW}Step 8: Generate Schedule with Midnight Crossover (18:00 to 00:00)${NC}"
SCHEDULE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/schedule/generate/shows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"show_ids\": [\"$BEBOP_CONTENT_ID\"],
    \"start_date\": \"2024-12-14\",
    \"end_date\": \"2024-12-14\",
    \"start_time\": \"18:00\",
    \"end_time\": \"00:00\",
    \"rotation_type\": \"round_robin\"
  }")

HTTP_CODE=$(echo "$SCHEDULE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SCHEDULE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.'
else
  echo "$RESPONSE_BODY" | jq '.count'
  echo "$RESPONSE_BODY" | jq '.schedule[0:5]'
  if [ "$(echo "$RESPONSE_BODY" | jq -r '.count // 0')" = "0" ]; then
    echo -e "${YELLOW}⚠️  No schedule items generated${NC}"
    echo "$RESPONSE_BODY" | jq '.message // empty'
  else
    echo -e "${GREEN}✅ Midnight crossover schedule generated${NC}"
  fi
fi

# Clean up after test
delete_schedule_for_date "2024-12-13" "2024-12-31"
clear_queue
echo ""

# Step 9: Test with 2 shows
echo -e "${YELLOW}Step 9: Generate Schedule with 2 Shows (Cowboy Bebop + Dragon Ball Z)${NC}"
echo "Adding shows to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$BEBOP_CONTENT_ID\"}" > /dev/null
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$DBZ_CONTENT_ID\"}" > /dev/null
echo -e "${GREEN}✅ Shows added to queue${NC}"

echo "Fetching episodes for Dragon Ball Z..."
curl -s -X GET "$BASE_URL/api/content/$DBZ_ID/episodes" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
EPISODE_COUNT=$(curl -s -X GET "$BASE_URL/api/content/$DBZ_ID/episodes" \
  -H "Authorization: Bearer $TOKEN" | jq 'length')
echo -e "${GREEN}✅ DBZ: $EPISODE_COUNT episodes cached${NC}"

echo "Generating schedule with 2 shows (round_robin rotation)..."
SCHEDULE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/schedule/generate/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-14",
    "end_date": "2024-12-14",
    "start_time": "18:00",
    "end_time": "20:00",
    "time_slot_duration": 30,
    "max_shows_per_time_slot": 1,
    "include_reruns": false,
    "rerun_frequency": "rarely",
    "rotation_type": "round_robin"
  }')

HTTP_CODE=$(echo "$SCHEDULE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SCHEDULE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.'
else
  echo "$RESPONSE_BODY" | jq '.count'
  echo "$RESPONSE_BODY" | jq '.schedule[0:10]' # Show first 10 schedule items
  if [ "$(echo "$RESPONSE_BODY" | jq -r '.count // 0')" = "0" ]; then
    echo -e "${YELLOW}⚠️  No schedule items generated${NC}"
    echo "$RESPONSE_BODY" | jq '.message // empty'
  else
    echo -e "${GREEN}✅ Schedule with 2 shows generated${NC}"
  fi
fi

# Clean up after test
delete_schedule_for_date "2024-12-13" "2024-12-31"
clear_queue
echo ""

# Step 10: Test with 3 shows
echo -e "${YELLOW}Step 10: Generate Schedule with 3 Shows (Cowboy Bebop + DBZ + Sailor Moon)${NC}"
echo "Adding shows to queue..."
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$BEBOP_CONTENT_ID\"}" > /dev/null
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$DBZ_CONTENT_ID\"}" > /dev/null
curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$SAILOR_MOON_CONTENT_ID\"}" > /dev/null
echo -e "${GREEN}✅ Shows added to queue${NC}"

echo "Fetching episodes for Sailor Moon..."
curl -s -X GET "$BASE_URL/api/content/$SAILOR_MOON_ID/episodes" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
EPISODE_COUNT=$(curl -s -X GET "$BASE_URL/api/content/$SAILOR_MOON_ID/episodes" \
  -H "Authorization: Bearer $TOKEN" | jq 'length')
echo -e "${GREEN}✅ Sailor Moon: $EPISODE_COUNT episodes cached${NC}"

echo "Generating schedule with 3 shows (round_robin rotation)..."
SCHEDULE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/schedule/generate/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-14",
    "end_date": "2024-12-14",
    "start_time": "18:00",
    "end_time": "20:00",
    "time_slot_duration": 30,
    "max_shows_per_time_slot": 1,
    "include_reruns": false,
    "rerun_frequency": "rarely",
    "rotation_type": "round_robin"
  }')

HTTP_CODE=$(echo "$SCHEDULE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SCHEDULE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.'
else
  echo "$RESPONSE_BODY" | jq '.count'
  echo "$RESPONSE_BODY" | jq '.schedule[0:15]' # Show first 15 schedule items
  if [ "$(echo "$RESPONSE_BODY" | jq -r '.count // 0')" = "0" ]; then
    echo -e "${YELLOW}⚠️  No schedule items generated${NC}"
    echo "$RESPONSE_BODY" | jq '.message // empty'
  else
    echo -e "${GREEN}✅ Schedule with 3 shows generated${NC}"
  fi
fi

# Clean up after test
delete_schedule_for_date "2024-12-13" "2024-12-31"
clear_queue
echo ""

# Step 11: Test with Movie (The Matrix) and longer programming block
echo -e "${YELLOW}Step 11: Generate Schedule with Movie (The Matrix) - Long Block (18:00 to 23:00)${NC}"

echo "Fetching The Matrix..."
MATRIX_CONTENT=$(curl -s -X GET "$BASE_URL/api/content/$MATRIX_ID" \
  -H "Authorization: Bearer $TOKEN")
MATRIX_CONTENT_ID=$(echo $MATRIX_CONTENT | jq -r '.id')
echo -e "${GREEN}✅ The Matrix cached: $MATRIX_CONTENT_ID${NC}"

echo "Adding The Matrix to queue..."
QUEUE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$MATRIX_CONTENT_ID\"}")
echo "$QUEUE_RESPONSE" | jq '.'
echo -e "${GREEN}✅ The Matrix added to queue${NC}"

echo "Verifying queue contents..."
QUEUE_CONTENT=$(curl -s -X GET "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN")
echo "$QUEUE_CONTENT" | jq '.[] | {content_id, title, content_type}'

echo "Generating schedule with movie (18:00 to 23:00, 5-hour block)..."
SCHEDULE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/schedule/generate/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-14",
    "end_date": "2024-12-14",
    "start_time": "18:00",
    "end_time": "23:00",
    "time_slot_duration": 30,
    "max_shows_per_time_slot": 1,
    "include_reruns": false,
    "rerun_frequency": "rarely",
    "rotation_type": "round_robin"
  }')

HTTP_CODE=$(echo "$SCHEDULE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SCHEDULE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.'
else
  echo "$RESPONSE_BODY" | jq '.count'
  echo "$RESPONSE_BODY" | jq '.schedule[0:10]' # Show first 10 schedule items
  if [ "$(echo "$RESPONSE_BODY" | jq -r '.count // 0')" = "0" ]; then
    echo -e "${YELLOW}⚠️  No schedule items generated${NC}"
    echo "$RESPONSE_BODY" | jq '.message // empty'
  else
    echo -e "${GREEN}✅ Schedule with movie generated (5-hour block)${NC}"
    # Show summary
    TOTAL_DURATION=$(echo "$RESPONSE_BODY" | jq '[.schedule[].duration] | add')
    echo "Total scheduled duration: $TOTAL_DURATION minutes ($(echo "scale=1; $TOTAL_DURATION / 60" | bc) hours)"
  fi
fi

# Clean up after test
delete_schedule_for_date "2024-12-13" "2024-12-31"
clear_queue
echo ""

# Step 12: Test with Movie and Show together
echo -e "${YELLOW}Step 12: Generate Schedule with Movie (The Matrix) and Show (Cowboy Bebop)${NC}"

echo "Adding The Matrix to queue..."
MATRIX_QUEUE=$(curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$MATRIX_CONTENT_ID\"}")
echo -e "${GREEN}✅ The Matrix added to queue${NC}"

echo "Adding Cowboy Bebop to queue..."
BEBOP_QUEUE=$(curl -s -X POST "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_id\": \"$BEBOP_CONTENT_ID\"}")
echo -e "${GREEN}✅ Cowboy Bebop added to queue${NC}"

echo "Verifying queue contents..."
QUEUE_CONTENT=$(curl -s -X GET "$BASE_URL/api/queue" \
  -H "Authorization: Bearer $TOKEN")
echo "$QUEUE_CONTENT" | jq '.[] | {content_id, title, content_type}'

echo "Generating schedule with movie and show (18:00 to 23:00)..."
SCHEDULE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/schedule/generate/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-15",
    "end_date": "2024-12-15",
    "start_time": "18:00",
    "end_time": "23:00",
    "time_slot_duration": 30,
    "max_shows_per_time_slot": 1,
    "include_reruns": false,
    "rerun_frequency": "rarely",
    "rotation_type": "round_robin"
  }')

HTTP_CODE=$(echo "$SCHEDULE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$SCHEDULE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.'
else
  echo "$RESPONSE_BODY" | jq '.count'
  echo "$RESPONSE_BODY" | jq '.schedule[0:15]' # Show first 15 schedule items
  if [ "$(echo "$RESPONSE_BODY" | jq -r '.count // 0')" = "0" ]; then
    echo -e "${YELLOW}⚠️  No schedule items generated${NC}"
    echo "$RESPONSE_BODY" | jq '.message // empty'
  else
    echo -e "${GREEN}✅ Schedule with movie and show generated${NC}"
    # Show summary by content type
    echo "Schedule breakdown:"
    echo "$RESPONSE_BODY" | jq '[.schedule[] | {title: .title, content_type: .content_type, duration: .duration}] | group_by(.content_type) | .[] | {type: .[0].content_type, count: length, total_duration: ([.[].duration] | add)}'
  fi
fi

# Clean up after test
delete_schedule_for_date "2024-12-13" "2024-12-31"
clear_queue
echo ""

# Step 13: Get library
echo -e "${YELLOW}Step 13: View Library${NC}"
curl -s -X GET "$BASE_URL/api/content/library" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {title: .title, content_type: .content_type}'
echo ""

echo -e "${GREEN}✅ All Toonami tests completed!${NC}"

