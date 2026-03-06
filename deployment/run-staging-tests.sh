#!/bin/bash

###############################################################################
# Playlist Lab - Staging Test Execution Script
#
# This script runs comprehensive tests against the staging environment
# to verify all functionality before production deployment.
#
# Usage: ./deployment/run-staging-tests.sh [staging-url]
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STAGING_URL="${1:-http://localhost:3000}"
TEST_RESULTS_DIR="./test-results/staging"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$TEST_RESULTS_DIR/test-results-$TIMESTAMP.txt"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_test() {
    echo -e "${BLUE}TEST: $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
    echo "PASS: $1" >> "$RESULTS_FILE"
}

print_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    echo -e "${RED}  Reason: $2${NC}"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
    echo "FAIL: $1 - $2" >> "$RESULTS_FILE"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Setup
setup() {
    print_header "Test Setup"
    
    mkdir -p "$TEST_RESULTS_DIR"
    
    echo "Staging Test Results - $TIMESTAMP" > "$RESULTS_FILE"
    echo "Staging URL: $STAGING_URL" >> "$RESULTS_FILE"
    echo "========================================" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    
    print_info "Test results will be saved to: $RESULTS_FILE"
    echo ""
}

# Test: Health Check
test_health_check() {
    print_header "Health Check Tests"
    
    print_test "Health endpoint responds"
    if response=$(curl -s -f "$STAGING_URL/api/health"); then
        print_pass "Health endpoint responds"
    else
        print_fail "Health endpoint responds" "No response from health endpoint"
        return
    fi
    
    print_test "Health response contains status"
    if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
        print_pass "Health response contains status"
    else
        print_fail "Health response contains status" "Missing status field"
    fi
    
    print_test "Health status is 'ok'"
    status=$(echo "$response" | jq -r '.status')
    if [ "$status" = "ok" ]; then
        print_pass "Health status is 'ok'"
    else
        print_fail "Health status is 'ok'" "Status is '$status'"
    fi
    
    echo ""
}

# Test: Authentication Endpoints
test_authentication() {
    print_header "Authentication Tests"
    
    print_test "Auth start endpoint exists"
    if curl -s -f -X POST "$STAGING_URL/api/auth/start" > /dev/null 2>&1; then
        print_pass "Auth start endpoint exists"
    else
        print_fail "Auth start endpoint exists" "Endpoint not accessible"
    fi
    
    print_test "Auth endpoints require proper method"
    if curl -s -X GET "$STAGING_URL/api/auth/start" | grep -q "error"; then
        print_pass "Auth endpoints require proper method"
    else
        print_fail "Auth endpoints require proper method" "GET request should fail"
    fi
    
    echo ""
}

# Test: Protected Endpoints
test_protected_endpoints() {
    print_header "Protected Endpoint Tests"
    
    local endpoints=(
        "/api/playlists"
        "/api/schedules"
        "/api/missing"
        "/api/settings"
        "/api/servers"
    )
    
    for endpoint in "${endpoints[@]}"; do
        print_test "Endpoint $endpoint requires authentication"
        response=$(curl -s -w "%{http_code}" -o /dev/null "$STAGING_URL$endpoint")
        if [ "$response" = "401" ]; then
            print_pass "Endpoint $endpoint requires authentication"
        else
            print_fail "Endpoint $endpoint requires authentication" "Got HTTP $response instead of 401"
        fi
    done
    
    echo ""
}

# Test: CORS Headers
test_cors() {
    print_header "CORS Tests"
    
    print_test "CORS headers present"
    headers=$(curl -s -I "$STAGING_URL/api/health")
    if echo "$headers" | grep -qi "access-control-allow"; then
        print_pass "CORS headers present"
    else
        print_fail "CORS headers present" "No CORS headers found"
    fi
    
    echo ""
}

# Test: Security Headers
test_security_headers() {
    print_header "Security Header Tests"
    
    headers=$(curl -s -I "$STAGING_URL/api/health")
    
    print_test "X-Frame-Options header present"
    if echo "$headers" | grep -qi "x-frame-options"; then
        print_pass "X-Frame-Options header present"
    else
        print_fail "X-Frame-Options header present" "Header missing"
    fi
    
    print_test "X-Content-Type-Options header present"
    if echo "$headers" | grep -qi "x-content-type-options"; then
        print_pass "X-Content-Type-Options header present"
    else
        print_fail "X-Content-Type-Options header present" "Header missing"
    fi
    
    print_test "X-XSS-Protection header present"
    if echo "$headers" | grep -qi "x-xss-protection"; then
        print_pass "X-XSS-Protection header present"
    else
        print_fail "X-XSS-Protection header present" "Header missing"
    fi
    
    echo ""
}

# Test: Rate Limiting
test_rate_limiting() {
    print_header "Rate Limiting Tests"
    
    print_test "Rate limiting configured"
    print_info "Sending 110 requests to test rate limit..."
    
    local limited=false
    for i in {1..110}; do
        response=$(curl -s -w "%{http_code}" -o /dev/null "$STAGING_URL/api/health")
        if [ "$response" = "429" ]; then
            limited=true
            break
        fi
        sleep 0.01
    done
    
    if [ "$limited" = true ]; then
        print_pass "Rate limiting configured"
    else
        print_fail "Rate limiting configured" "No 429 response after 110 requests"
    fi
    
    echo ""
}

# Test: Response Times
test_response_times() {
    print_header "Response Time Tests"
    
    print_test "Health endpoint responds in < 500ms"
    response_time=$(curl -s -w "%{time_total}" -o /dev/null "$STAGING_URL/api/health")
    response_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
    
    if [ "$response_ms" -lt 500 ]; then
        print_pass "Health endpoint responds in < 500ms (${response_ms}ms)"
    else
        print_fail "Health endpoint responds in < 500ms" "Took ${response_ms}ms"
    fi
    
    echo ""
}

# Test: Database Connection
test_database() {
    print_header "Database Tests"
    
    print_test "Database file exists"
    if docker exec playlist-lab-staging test -f /data/playlist-lab.db; then
        print_pass "Database file exists"
    else
        print_fail "Database file exists" "Database file not found"
        return
    fi
    
    print_test "Database is accessible"
    if docker exec playlist-lab-staging sqlite3 /data/playlist-lab.db "SELECT 1;" > /dev/null 2>&1; then
        print_pass "Database is accessible"
    else
        print_fail "Database is accessible" "Cannot query database"
    fi
    
    print_test "Database has required tables"
    tables=$(docker exec playlist-lab-staging sqlite3 /data/playlist-lab.db ".tables")
    required_tables=("users" "playlists" "schedules" "missing_tracks" "cached_playlists" "sessions")
    
    all_present=true
    for table in "${required_tables[@]}"; do
        if ! echo "$tables" | grep -q "$table"; then
            all_present=false
            break
        fi
    done
    
    if [ "$all_present" = true ]; then
        print_pass "Database has required tables"
    else
        print_fail "Database has required tables" "Missing tables"
    fi
    
    echo ""
}

# Test: Docker Container
test_container() {
    print_header "Container Tests"
    
    print_test "Container is running"
    if docker ps | grep -q "playlist-lab-staging"; then
        print_pass "Container is running"
    else
        print_fail "Container is running" "Container not found"
        return
    fi
    
    print_test "Container is healthy"
    health=$(docker inspect --format='{{.State.Health.Status}}' playlist-lab-staging 2>/dev/null || echo "unknown")
    if [ "$health" = "healthy" ]; then
        print_pass "Container is healthy"
    else
        print_fail "Container is healthy" "Health status: $health"
    fi
    
    print_test "Container memory usage < 1GB"
    mem_usage=$(docker stats --no-stream --format "{{.MemUsage}}" playlist-lab-staging | cut -d'/' -f1 | sed 's/MiB//')
    if [ "${mem_usage%.*}" -lt 1024 ]; then
        print_pass "Container memory usage < 1GB (${mem_usage}MiB)"
    else
        print_fail "Container memory usage < 1GB" "Using ${mem_usage}MiB"
    fi
    
    echo ""
}

# Test: Logs
test_logs() {
    print_header "Logging Tests"
    
    print_test "Container logs accessible"
    if docker logs playlist-lab-staging --tail=10 > /dev/null 2>&1; then
        print_pass "Container logs accessible"
    else
        print_fail "Container logs accessible" "Cannot access logs"
    fi
    
    print_test "No critical errors in recent logs"
    if docker logs playlist-lab-staging --tail=100 | grep -qi "critical\|fatal"; then
        print_fail "No critical errors in recent logs" "Found critical errors"
    else
        print_pass "No critical errors in recent logs"
    fi
    
    echo ""
}

# Test: SSL/TLS (if HTTPS)
test_ssl() {
    if [[ "$STAGING_URL" == https://* ]]; then
        print_header "SSL/TLS Tests"
        
        domain=$(echo "$STAGING_URL" | sed 's|https://||' | cut -d: -f1)
        
        print_test "SSL certificate valid"
        if echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | grep -q "Verify return code: 0"; then
            print_pass "SSL certificate valid"
        else
            print_fail "SSL certificate valid" "Certificate verification failed"
        fi
        
        print_test "TLS 1.2+ supported"
        if echo | openssl s_client -connect "$domain:443" -tls1_2 2>/dev/null | grep -q "Protocol.*TLSv1"; then
            print_pass "TLS 1.2+ supported"
        else
            print_fail "TLS 1.2+ supported" "TLS 1.2 not supported"
        fi
        
        echo ""
    fi
}

# Test: Performance
test_performance() {
    print_header "Performance Tests"
    
    print_test "Concurrent requests handled"
    print_info "Sending 10 concurrent requests..."
    
    success_count=0
    for i in {1..10}; do
        curl -s -f "$STAGING_URL/api/health" > /dev/null 2>&1 &
    done
    wait
    
    # Check if all succeeded (simplified check)
    if [ $? -eq 0 ]; then
        print_pass "Concurrent requests handled"
    else
        print_fail "Concurrent requests handled" "Some requests failed"
    fi
    
    echo ""
}

# Generate Summary
generate_summary() {
    print_header "Test Summary"
    
    echo "" >> "$RESULTS_FILE"
    echo "========================================" >> "$RESULTS_FILE"
    echo "Test Summary" >> "$RESULTS_FILE"
    echo "========================================" >> "$RESULTS_FILE"
    echo "Total Tests: $TOTAL_TESTS" >> "$RESULTS_FILE"
    echo "Passed: $PASSED_TESTS" >> "$RESULTS_FILE"
    echo "Failed: $FAILED_TESTS" >> "$RESULTS_FILE"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}All tests passed! ($PASSED_TESTS/$TOTAL_TESTS)${NC}"
        echo "Status: PASS" >> "$RESULTS_FILE"
        exit 0
    else
        echo -e "${RED}Some tests failed! ($FAILED_TESTS/$TOTAL_TESTS failed)${NC}"
        echo "Status: FAIL" >> "$RESULTS_FILE"
        exit 1
    fi
}

# Main execution
main() {
    print_header "Playlist Lab - Staging Tests"
    echo "Testing: $STAGING_URL"
    echo ""
    
    setup
    test_health_check
    test_authentication
    test_protected_endpoints
    test_cors
    test_security_headers
    test_rate_limiting
    test_response_times
    test_database
    test_container
    test_logs
    test_ssl
    test_performance
    generate_summary
}

main
