# Load Testing

## Setup

### 1. Install k6

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 379CE192D401AB61
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### 2. Get an Auth Token

For authenticated endpoint testing, you need a JWT token. You can get one by:
1. Logging into the app
2. Opening browser DevTools → Network tab
3. Finding any API request and copying the `Authorization: Bearer xxx` header value

## Running Tests

### Smoke Test (Quick Health Check)
```bash
k6 run --vus 1 --duration 10s backend/tests/load/k6-load-test.js
```

### Load Test (Normal Traffic)
```bash
k6 run --vus 20 --duration 1m backend/tests/load/k6-load-test.js
```

### With Authentication (Full Test)
```bash
k6 run -e AUTH_TOKEN=your_jwt_token backend/tests/load/k6-load-test.js
```

### Against Production
```bash
k6 run -e API_URL=https://api.showshowshow.com -e AUTH_TOKEN=xxx backend/tests/load/k6-load-test.js
```

## Supabase Free Tier Considerations

**Connection Limit: 15 connections**

With the default `DB_POOL_MAX=5`, you can handle:
- ~5 concurrent database operations per instance
- Multiple HTTP requests can share connections

### Recommended Settings for Demo

```bash
# In your .env
DB_POOL_MAX=5                    # Keep conservative for free tier
SLOW_QUERY_THRESHOLD_MS=500      # Catch slow queries early
```

### Use Supabase Connection Pooler

For better handling of traffic spikes, switch to the Supabase pooler:

1. Go to Supabase Dashboard → Project Settings → Database
2. Find "Connection Pooling" section
3. Copy the "Transaction" mode connection string

```bash
# Direct connection (current - limited to 15 connections)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# Pooler connection (recommended for Show HN)
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

The pooler:
- Uses port `6543` instead of `5432`
- Has `pooler.supabase.com` in the hostname
- Can handle 200+ concurrent connections on free tier
- Add `?pgbouncer=true` to the connection string

## Interpreting Results

### Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| `http_req_duration p(95)` | < 500ms | 95th percentile response time |
| `http_req_failed` | < 1% | Percentage of failed requests |
| `vus` | - | Virtual users (concurrent connections) |

### Common Issues

**"Too many connections"**
- Switch to Supabase pooler
- Reduce `DB_POOL_MAX`
- Reduce k6 VUs

**High latency (> 500ms)**
- Check slow query logs
- Review database indexes
- Consider caching with Redis

**5xx errors under load**
- Check backend logs for errors
- May need to increase rate limits
- Database connection exhaustion

## Show HN Preparation Checklist

- [ ] Switch to Supabase connection pooler
- [ ] Run smoke test against production
- [ ] Run 50 VU load test for 2 minutes
- [ ] Verify PostHog error tracking is working
- [ ] Check slow query threshold is set (`SLOW_QUERY_THRESHOLD_MS=500`)
- [ ] Monitor Supabase dashboard during test