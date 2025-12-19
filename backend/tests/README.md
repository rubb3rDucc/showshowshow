# ShowShowShow Test Scripts

## Overview

This directory contains automated test scripts for the ShowShowShow backend API.

## Prerequisites

1. **Install dependencies:**
   ```bash
   # macOS
   brew install jq
   
   # Linux
   sudo apt install jq
   ```

2. **Start the backend server:**
   ```bash
   cd backend
   pnpm install
   pnpm run dev
   ```

   The server should be running on `http://localhost:3000`

## Test Scripts

### 1. Content Type Tests

**File:** `test-content-types.sh`

Tests the new content type handling features:
- Type-specific content fetching (`?type=tv` or `?type=movie`)
- Type-filtered search
- Automatic type correction
- Mixed content scheduling

**Run locally:**
```bash
cd backend/tests
./test-content-types.sh
```

**Run against deployed backend:**
```bash
export BASE_URL="https://your-backend-url.com"
./test-content-types.sh
```

### 2. Toonami Show Tests

**File:** `toonami-tests.sh`

Comprehensive tests for Toonami-related functionality:
- Multiple show handling
- Episode fetching
- Queue management
- Schedule generation with different rotation types
- Movie scheduling
- Mixed content (TV shows + movies)

**Run locally:**
```bash
cd backend/tests
./toonami-tests.sh
```

**Run against deployed backend:**
```bash
export BASE_URL="https://your-backend-url.com"
./toonami-tests.sh
```

## Running Tests Locally

### Quick Start

1. **Terminal 1 - Start the server:**
   ```bash
   cd backend
   pnpm run dev
   ```

2. **Terminal 2 - Run tests:**
   ```bash
   cd backend/tests
   ./test-content-types.sh
   ```

### Step-by-Step

1. **Make sure the server is running:**
   ```bash
   # Check if server is responding
   curl http://localhost:3000/health
   ```

2. **Make scripts executable:**
   ```bash
   chmod +x test-content-types.sh
   chmod +x toonami-tests.sh
   ```

3. **Run tests:**
   ```bash
   # Run content type tests
   ./test-content-types.sh
   
   # Run Toonami tests
   ./toonami-tests.sh
   ```

## Running Tests Against Deployed Backend

### Option 1: Set Environment Variable

```bash
export BASE_URL="https://your-backend-url.com"
./test-content-types.sh
```

### Option 2: Inline

```bash
BASE_URL="https://your-backend-url.com" ./test-content-types.sh
```

### Option 3: Edit Script

Edit the test script and change the BASE_URL line:

```bash
# In test-content-types.sh or toonami-tests.sh
BASE_URL="${BASE_URL:-https://your-backend-url.com}"
```

## Expected Output

### Successful Test Run

You should see:
- ✅ Green checkmarks for successful operations
- JSON output from API responses
- Summary of operations performed
- Final success message

### Example:

```
======================================
Content Type Handling Tests
======================================
Backend URL: http://localhost:3000

Step 1: Authenticating...
✅ Authenticated

Step 2: Searching for 'Cowboy Bebop' (all types)...
[
  {
    "tmdb_id": 30991,
    "title": "Cowboy Bebop",
    "media_type": "tv",
    "release_date": "1998-04-03",
    "vote_average": 8.5
  },
  ...
]

...

======================================
✅ All tests completed!
======================================
```

## Troubleshooting

### Issue: "Connection refused"

**Cause:** Backend server is not running

**Solution:**
```bash
# Start the server in another terminal
cd backend
pnpm run dev
```

### Issue: "Authentication failed"

**Cause:** User already exists but password doesn't match

**Solution:** The script will automatically try to login if registration fails

### Issue: "jq: command not found"

**Cause:** jq is not installed

**Solution:**
```bash
# macOS
brew install jq

# Linux
sudo apt install jq
```

Or remove `| jq '.'` from the test scripts

### Issue: "No episodes available to schedule"

**Cause:** Episodes weren't fetched before schedule generation

**Solution:** The test scripts now explicitly fetch episodes before scheduling. If you're writing custom tests, always fetch episodes first:
```bash
curl -X GET "$BASE_URL/api/content/30991/episodes" \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: "Wrong content cached"

**Cause:** TMDB ID exists as both movie and TV show

**Solution:** Use the `?type=` parameter:
```bash
# Force TV show
curl -X GET "$BASE_URL/api/content/30991?type=tv" \
  -H "Authorization: Bearer $TOKEN"
```

## Cleaning Up Test Data

### Option 1: Clear Specific User's Data (SQL)

```sql
-- In Supabase or local PostgreSQL
-- Replace 'test-user-id' with actual user ID
DELETE FROM schedule WHERE user_id = 'test-user-id';
DELETE FROM queue WHERE user_id = 'test-user-id';
DELETE FROM watch_history WHERE user_id = 'test-user-id';
DELETE FROM user_preferences WHERE user_id = 'test-user-id';
DELETE FROM users WHERE id = 'test-user-id';
```

### Option 2: Clear All Test Data

```sql
-- DANGER: This deletes ALL data
TRUNCATE TABLE schedule CASCADE;
TRUNCATE TABLE queue CASCADE;
TRUNCATE TABLE watch_history CASCADE;
TRUNCATE TABLE episodes CASCADE;
TRUNCATE TABLE content CASCADE;
TRUNCATE TABLE user_preferences CASCADE;
TRUNCATE TABLE users CASCADE;
```

### Option 3: Reset Database

```bash
# Drop and recreate the database (local only)
cd backend
pnpm run migrate:down
pnpm run migrate:up
```

## Writing Custom Tests

### Basic Template

```bash
#!/bin/bash

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Authenticate
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.token')

# If registration fails, try login
if [ "$TOKEN" == "null" ]; then
  TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}' | jq -r '.token')
fi

# Your test logic here
echo "Testing..."

# Example: Cache content
CONTENT=$(curl -s -X GET "$BASE_URL/api/content/30991?type=tv" \
  -H "Authorization: Bearer $TOKEN")

echo "$CONTENT" | jq '.'
```

### Best Practices

1. **Always check for authentication success:**
   ```bash
   if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
     echo "❌ Authentication failed"
     exit 1
   fi
   ```

2. **Use explicit type parameters:**
   ```bash
   # Good
   curl -X GET "$BASE_URL/api/content/30991?type=tv"
   
   # Risky (might cache wrong type)
   curl -X GET "$BASE_URL/api/content/30991"
   ```

3. **Fetch episodes before scheduling:**
   ```bash
   # Always do this first
   curl -X GET "$BASE_URL/api/content/30991/episodes" \
     -H "Authorization: Bearer $TOKEN"
   
   # Then generate schedule
   curl -X POST "$BASE_URL/api/schedule/generate/queue" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"start_date":"2024-12-20",...}'
   ```

4. **Check response status:**
   ```bash
   HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
     "$BASE_URL/api/auth/me" \
     -H "Authorization: Bearer $TOKEN")
   
   if [ "$HTTP_CODE" != "200" ]; then
     echo "❌ Failed with HTTP $HTTP_CODE"
     exit 1
   fi
   ```

## Continuous Integration

### GitHub Actions Example

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: |
          cd backend
          pnpm install
      
      - name: Run migrations
        run: |
          cd backend
          pnpm run migrate:up
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Start server
        run: |
          cd backend
          pnpm run dev &
          sleep 5
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          JWT_SECRET: test-secret
          TMDB_API_KEY: ${{ secrets.TMDB_API_KEY }}
      
      - name: Run tests
        run: |
          cd backend/tests
          ./test-content-types.sh
```

## Performance Testing

For load testing, consider using Apache Bench or similar:

```bash
# Install Apache Bench
brew install httpd  # macOS
sudo apt install apache2-utils  # Linux

# Test endpoint performance
ab -n 1000 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/content/library
```

## Next Steps

1. **Run the tests locally** to verify your setup
2. **Review the output** to understand the API flow
3. **Check the database** to see what data was created
4. **Experiment** with different parameters
5. **Build your frontend** using the tested API endpoints

## Additional Resources

- **API Reference:** `../API_REFERENCE.md`
- **curl Cheatsheet:** `../CURL_CHEATSHEET.md`
- **Deployment Testing:** `../TESTING_DEPLOYED.md`
- **Implementation Details:** `../../CONTENT_TYPE_FIX.md`

