# Toonami Show Tests

Complete test examples using real TMDB IDs for classic Toonami shows.

## Toonami Show IDs (from TMDB)

- **Dragon Ball Z**: 12971
- **Sailor Moon**: 3570
- **Mobile Suit Gundam Wing**: 21730
- **Outlaw Star**: 35106
- **Cowboy Bebop**: 30991
- **Tenchi Muyo!**: 43004
- **The Big O**: 18241
- **Yu Yu Hakusho**: 30669
- **Rurouni Kenshin**: 210879
- **Naruto**: 46260

## Quick Test Script

Run the automated test script:

```bash
chmod +x tests/toonami-tests.sh
./tests/toonami-tests.sh
```

## Manual Test Examples

### 1. Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"toonami@test.com","password":"password123"}'

# Login (save token)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"toonami@test.com","password":"password123"}' \
  | jq -r '.token')
```

### 2. Fetch and Cache Toonami Shows

```bash
# Dragon Ball Z
curl -X GET "http://localhost:3000/api/content/12971" \
  -H "Authorization: Bearer $TOKEN"

# Sailor Moon
curl -X GET "http://localhost:3000/api/content/3570" \
  -H "Authorization: Bearer $TOKEN"

# Gundam Wing
curl -X GET "http://localhost:3000/api/content/21730" \
  -H "Authorization: Bearer $TOKEN"

# Cowboy Bebop
curl -X GET "http://localhost:3000/api/content/30991" \
  -H "Authorization: Bearer $TOKEN"
```

Save the `id` from each response (not the tmdb_id) - you'll need these content IDs.

### 3. Get Episodes

```bash
# Get all episodes for Dragon Ball Z
curl -X GET "http://localhost:3000/api/content/12971/episodes" \
  -H "Authorization: Bearer $TOKEN"

# Get Season 1 episodes only
curl -X GET "http://localhost:3000/api/content/12971/episodes?season=1" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Add Shows to Queue

```bash
# Add Dragon Ball Z (replace CONTENT_ID with actual ID from step 2)
curl -X POST http://localhost:3000/api/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content_id":"CONTENT_ID"}'

# Add Sailor Moon
curl -X POST http://localhost:3000/api/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content_id":"SAILOR_MOON_CONTENT_ID"}'

# Add Gundam Wing
curl -X POST http://localhost:3000/api/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content_id":"GUNDAM_CONTENT_ID"}'
```

### 5. View Queue

```bash
curl -X GET http://localhost:3000/api/queue \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Generate Schedule from Queue (Toonami Block)

```bash
curl -X POST http://localhost:3000/api/schedule/generate/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-14",
    "end_date": "2024-12-21",
    "start_time": "18:00",
    "end_time": "00:00",
    "time_slot_duration": 30,
    "max_shows_per_time_slot": 1,
    "include_reruns": false,
    "rerun_frequency": "rarely",
    "rotation_type": "round_robin"
  }'
```

This creates a classic Toonami-style schedule:
- Rotates through shows (DBZ → Sailor Moon → Gundam → repeat)
- 30-minute time slots
- Saturday night block (6pm-midnight)

### 7. Generate Schedule with Random Rotation

```bash
curl -X POST http://localhost:3000/api/schedule/generate/shows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "show_ids": ["DBZ_CONTENT_ID", "SAILOR_MOON_CONTENT_ID", "GUNDAM_CONTENT_ID"],
    "start_date": "2024-12-14",
    "end_date": "2024-12-21",
    "start_time": "18:00",
    "end_time": "00:00",
    "rotation_type": "random"
  }'
```

### 8. View Schedule

```bash
# Get schedule for date range
curl -X GET "http://localhost:3000/api/schedule?start=2024-12-14&end=2024-12-21" \
  -H "Authorization: Bearer $TOKEN"

# Get schedule for specific date (Saturday)
curl -X GET "http://localhost:3000/api/schedule/date/2024-12-14" \
  -H "Authorization: Bearer $TOKEN"
```

### 9. Mark as Watched

```bash
# Get schedule ID first, then mark as watched
SCHEDULE_ID="your-schedule-id"

curl -X POST "http://localhost:3000/api/schedule/$SCHEDULE_ID/watched" \
  -H "Authorization: Bearer $TOKEN"
```

### 10. Reorder Queue

```bash
# Get queue items first to get IDs
QUEUE_ITEMS=$(curl -s -X GET http://localhost:3000/api/queue \
  -H "Authorization: Bearer $TOKEN")

# Extract IDs and reorder (example: reverse order)
curl -X PUT http://localhost:3000/api/queue/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_ids":["id3","id2","id1"]}'
```

## Expected Results

### Schedule Generation
- Should create schedule items rotating through your 3 shows
- Each show gets episodes scheduled in order
- Time slots respect max shows per slot
- Episodes are scheduled sequentially

### Queue Management
- Shows appear in queue in order added
- Can reorder by sending new order
- Removing items auto-reorders remaining items

### Watch Tracking
- Marking schedule item as watched:
  - Updates schedule.watched = true
  - Creates/updates watch_history
  - Increments rewatch_count if already watched

## Test Scenarios

### Scenario 1: Classic Toonami Saturday Night
1. Add DBZ, Sailor Moon, Gundam to queue
2. Generate schedule for Saturday 6pm-12am
3. Should see rotation: DBZ → Sailor Moon → Gundam → repeat
4. Each episode scheduled in 30-min slots

### Scenario 2: Random Toonami Block
1. Generate schedule with random rotation
2. Shows should appear in random order
3. Still respects time slot limits

### Scenario 3: Reruns Enabled
1. Mark some episodes as watched
2. Generate schedule with `include_reruns: true`
3. Should see some watched episodes mixed in

