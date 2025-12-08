# Quick Test Guide - Schedule Generation

## The Problem

Schedule generation returns empty because **episodes need to be fetched first**.

When you fetch a show from TMDB (`GET /api/content/:tmdbId`), it only caches the show metadata, **not the episodes**. Episodes must be fetched separately.

## Solution: Fetch Episodes First

### Step-by-Step Test

1. **Login/Register**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')
```

2. **Fetch Show (Dragon Ball Z)**
```bash
curl -X GET "http://localhost:3000/api/content/12971" \
  -H "Authorization: Bearer $TOKEN"
```
Save the `id` from response (not `tmdb_id`).

3. **Fetch Episodes (REQUIRED!)**
```bash
# This fetches ALL episodes for all seasons
curl -X GET "http://localhost:3000/api/content/12971/episodes" \
  -H "Authorization: Bearer $TOKEN"
```

This will take a while - it fetches all seasons. You'll see episodes being saved.

4. **Add to Queue**
```bash
curl -X POST http://localhost:3000/api/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content_id":"CONTENT_ID_FROM_STEP_2"}'
```

5. **Now Generate Schedule**
```bash
curl -X POST http://localhost:3000/api/schedule/generate/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-12-14",
    "end_date": "2024-12-21",
    "start_time": "18:00",
    "end_time": "00:00"
  }'
```

## Why This Happens

- `GET /api/content/:tmdbId` → Caches show metadata only
- `GET /api/content/:tmdbId/episodes` → Fetches and caches episodes
- Schedule generation needs episodes in database → Must call episodes endpoint first

## Quick Fix for Testing

Fetch episodes for all shows in your queue before generating schedule:

```bash
# For each show in queue, fetch episodes
for TMDB_ID in 12971 3570 21730; do
  echo "Fetching episodes for TMDB ID: $TMDB_ID"
  curl -s -X GET "http://localhost:3000/api/content/$TMDB_ID/episodes" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
done
```

Then generate schedule - it should work!

## Check Server Logs

The schedule generator now logs:
- Total episodes in database
- Available episodes
- Why schedule generation might fail

Check your server console for these messages.

