#!/bin/bash

# Production Issue Verification Script
# Verifies fixes for WebSocket, Login, and 504 Gateway Timeout issues
# Usage: bash verify-production-fixes.sh

set -e

echo "🔍 BizTrixVenture Production Health Check"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to run tests and track results
run_test() {
  local name=$1
  local command=$2
  local expected=$3

  echo -n "Testing: $name... "

  if eval "$command" > /tmp/test_output.txt 2>&1; then
    output=$(cat /tmp/test_output.txt)
    if [[ $output == *"$expected"* ]]; then
      echo -e "${GREEN}✓ PASS${NC}"
      ((PASSED++))
      return 0
    else
      echo -e "${RED}✗ FAIL${NC} (unexpected output)"
      ((FAILED++))
      return 1
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (command error)"
    ((FAILED++))
    return 1
  fi
}

# === DOCKER CHECKS ===
echo -e "${YELLOW}=== Docker Container Status ===${NC}"

echo -n "API Container: "
if docker inspect -f '{{.State.Running}}' biztrixventure-api-1 | grep -q "true"; then
  echo -e "${GREEN}✓ Running${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ Not running${NC}"
  ((FAILED++))
fi

echo -n "Web Container: "
if docker inspect -f '{{.State.Running}}' biztrixventure-web-1 | grep -q "true"; then
  echo -e "${GREEN}✓ Running${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ Not running${NC}"
  ((FAILED++))
fi

echo ""
echo -e "${YELLOW}=== Network Connectivity ===${NC}"

# Check DNS resolution
echo -n "DNS (api hostname): "
if docker exec biztrixventure-web-1 nslookup api > /tmp/nslookup.txt 2>&1; then
  if grep -q "Address" /tmp/nslookup.txt; then
    echo -e "${GREEN}✓ Resolves${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ Cannot resolve${NC}"
    ((FAILED++))
  fi
else
  echo -e "${RED}✗ DNS failed${NC}"
  ((FAILED++))
fi

# Check API connectivity from web
echo -n "API Connectivity: "
if docker exec biztrixventure-web-1 curl -s http://api:4000/api/v1/health > /tmp/health.json 2>&1; then
  if grep -q "status" /tmp/health.json; then
    echo -e "${GREEN}✓ Connected${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ No response${NC}"
    ((FAILED++))
  fi
else
  echo -e "${RED}✗ Connection failed${NC}"
  ((FAILED++))
fi

echo ""
echo -e "${YELLOW}=== API Health ===${NC}"

# Check Socket.io initialization
echo -n "Socket.io Status: "
if docker logs biztrixventure-api-1 2>&1 | grep -q "Socket.io initialized"; then
  echo -e "${GREEN}✓ Initialized${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ Not initialized${NC}"
  ((FAILED++))
fi

# Check for API errors
echo -n "API Errors: "
if docker logs biztrixventure-api-1 2>&1 | grep -i "error" | head -1; then
  echo -e "${RED}✗ Found errors${NC}"
  ((FAILED++))
else
  echo -e "${GREEN}✓ No errors${NC}"
  ((PASSED++))
fi

echo ""
echo -e "${YELLOW}=== Nginx Configuration ===${NC}"

# Check nginx syntax
echo -n "Nginx Config: "
if docker exec biztrixventure-web-1 nginx -t 2>&1 | grep -q "successful"; then
  echo -e "${GREEN}✓ Valid${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ Invalid${NC}"
  ((FAILED++))
fi

# Check upstream configuration
echo -n "Upstream Block: "
if docker exec biztrixventure-web-1 grep -q "upstream api_backend" /etc/nginx/nginx.conf; then
  echo -e "${GREEN}✓ Configured${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ Not found${NC}"
  ((FAILED++))
fi

echo ""
echo -e "${YELLOW}=== Summary ===${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All checks passed! System is ready.${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some checks failed. See above for details.${NC}"
  exit 1
fi
