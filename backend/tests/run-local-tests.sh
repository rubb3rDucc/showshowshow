#!/bin/bash

# Quick script to run all tests against local instance
# Make sure your server is running first!

echo "======================================"
echo "ShowShowShow - Local Test Runner"
echo "======================================"
echo ""

# Check if server is running
echo "Checking if server is running..."
if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ Server is running on http://localhost:3000"
else
  echo "❌ Server is not responding on http://localhost:3000"
  echo ""
  echo "Please start the server first:"
  echo "  cd backend"
  echo "  pnpm run dev"
  echo ""
  exit 1
fi

echo ""
echo "======================================"
echo "Running Content Type Tests"
echo "======================================"
./test-content-types.sh

echo ""
echo ""
echo "======================================"
echo "Running Toonami Tests"
echo "======================================"
./toonami-tests.sh

echo ""
echo "======================================"
echo "✅ All tests completed!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Check your local database to see the test data"
echo "2. Review backend/API_REFERENCE.md for API details"
echo "3. Try the curl commands in backend/CURL_CHEATSHEET.md"
echo "4. Start building your frontend!"

