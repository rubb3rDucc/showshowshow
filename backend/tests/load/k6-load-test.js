/**
 * k6 Load Test for ShowShowShow API
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 *   brew install k6  (macOS)
 *
 * Run:
 *   k6 run backend/tests/load/k6-load-test.js
 *
 * With environment variables:
 *   k6 run -e API_URL=https://api.showshowshow.com -e AUTH_TOKEN=your_jwt backend/tests/load/k6-load-test.js
 *
 * Smoke test (quick check):
 *   k6 run --vus 1 --duration 10s backend/tests/load/k6-load-test.js
 *
 * Load test (sustained traffic):
 *   k6 run --vus 50 --duration 2m backend/tests/load/k6-load-test.js
 *
 * Stress test (find breaking point):
 *   k6 run --vus 100 --duration 5m backend/tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const scheduleLatency = new Trend('schedule_latency');
const networkLatency = new Trend('network_latency');
const queueLatency = new Trend('queue_latency');

// Configuration
const API_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''; // JWT token for authenticated endpoints

// Test options - configure based on expected Show HN traffic
export const options = {
  // Ramp up pattern simulating Show HN traffic spike
  stages: [
    { duration: '30s', target: 10 },   // Warm up
    { duration: '1m', target: 50 },    // Ramp to normal load
    { duration: '2m', target: 100 },   // Peak traffic (Show HN front page)
    { duration: '1m', target: 50 },    // Scale down
    { duration: '30s', target: 0 },    // Cool down
  ],

  // Thresholds - fail the test if these aren't met
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% errors
    errors: ['rate<0.01'],             // Custom error rate
  },
};

// Headers for authenticated requests
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (AUTH_TOKEN) {
    // Handle case where token might already include "Bearer " prefix
    const token = AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`;
    headers['Authorization'] = token;
  }
  return headers;
}

// Main test scenario
export default function () {
  const headers = getHeaders();

  // Simulate typical user flow
  group('Public Endpoints', () => {
    // Health check (unauthenticated)
    const healthRes = http.get(`${API_URL}/health`);
    check(healthRes, {
      'health check status 200': (r) => r.status === 200,
    });
    errorRate.add(healthRes.status !== 200);
  });

  // Only run authenticated tests if token is provided
  if (AUTH_TOKEN) {
    group('Schedule Endpoints', () => {
      // Get today's schedule - most common request
      const today = new Date().toISOString().split('T')[0];
      const scheduleStart = Date.now();
      const scheduleRes = http.get(`${API_URL}/api/schedule?date=${today}`, { headers });
      scheduleLatency.add(Date.now() - scheduleStart);

      const scheduleOk = check(scheduleRes, {
        'schedule status 200': (r) => r.status === 200,
        'schedule returns array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body);
          } catch {
            return false;
          }
        },
      });
      if (!scheduleOk) {
        console.log(`Schedule failed: status=${scheduleRes.status}, body=${scheduleRes.body?.substring(0, 200)}`);
      }
      errorRate.add(scheduleRes.status !== 200);
    });

    group('Queue Endpoints', () => {
      // Get queue
      const queueStart = Date.now();
      const queueRes = http.get(`${API_URL}/api/queue`, { headers });
      queueLatency.add(Date.now() - queueStart);

      check(queueRes, {
        'queue status 200': (r) => r.status === 200,
      });
      errorRate.add(queueRes.status !== 200);
    });

    group('Network Endpoints', () => {
      // Get networks list
      const networkStart = Date.now();
      const networkRes = http.get(`${API_URL}/api/networks`, { headers });
      networkLatency.add(Date.now() - networkStart);

      check(networkRes, {
        'networks status 200': (r) => r.status === 200,
      });
      errorRate.add(networkRes.status !== 200);
    });

    group('Library Endpoints', () => {
      // Get library
      const libraryRes = http.get(`${API_URL}/api/library`, { headers });
      check(libraryRes, {
        'library status 200': (r) => r.status === 200,
      });
      errorRate.add(libraryRes.status !== 200);
    });
  }

  // Simulate user think time between actions
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

// Lifecycle hooks
export function setup() {
  console.log(`🚀 Starting load test against ${API_URL}`);
  console.log(`📝 Auth token: ${AUTH_TOKEN ? `provided (${AUTH_TOKEN.substring(0, 20)}...)` : 'NOT provided (skipping authenticated endpoints)'}`);

  // Verify API is reachable
  const healthRes = http.get(`${API_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API not reachable at ${API_URL}. Status: ${healthRes.status}`);
  }

  // Test auth token if provided
  if (AUTH_TOKEN) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`,
    };
    const testRes = http.get(`${API_URL}/api/schedule?date=2026-01-12`, { headers });
    console.log(`📝 Auth test: status=${testRes.status}, body=${testRes.body?.substring(0, 100)}`);
    if (testRes.status !== 200) {
      console.log(`⚠️  Auth token may be invalid or expired. Status: ${testRes.status}`);
    }
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Load test completed in ${duration.toFixed(1)} seconds`);
}