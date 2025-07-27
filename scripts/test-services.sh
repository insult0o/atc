#!/bin/bash

# Test script to verify all services are working correctly

echo "🔍 PDF Intelligence Platform - Service Test"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test function
test_service() {
    local name=$1
    local url=$2
    local expected_text=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    http_code=$(echo "$response" | tail -1)
    content=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        if [ ! -z "$expected_text" ] && echo "$content" | grep -q "$expected_text"; then
            echo -e "${GREEN}✅ OK${NC} (HTTP $http_code)"
            return 0
        elif [ -z "$expected_text" ]; then
            echo -e "${GREEN}✅ OK${NC} (HTTP $http_code)"
            return 0
        else
            echo -e "${YELLOW}⚠️  OK but unexpected content${NC} (HTTP $http_code)"
            return 1
        fi
    else
        echo -e "${RED}❌ FAILED${NC} (HTTP $http_code)"
        return 1
    fi
}

# Test each service
echo "1. Backend API Tests:"
echo "---------------------"
test_service "API Docs" "http://localhost:8000/api/docs" "Swagger UI"
test_service "API Health" "http://localhost:8000/health" "healthy"
test_service "API Root" "http://localhost:8000/" ""

echo ""
echo "2. Frontend Tests:"
echo "------------------"
test_service "Frontend Homepage" "http://localhost:3000" ""
test_service "Frontend API Route" "http://localhost:3000/api/upload" ""

echo ""
echo "3. Processing Server Tests:"
echo "---------------------------"
test_service "Processing Health" "http://localhost:8001/health" ""
test_service "Processing Docs" "http://localhost:8001/docs" ""

echo ""
echo "4. API Endpoint Tests:"
echo "----------------------"
test_service "Documents API" "http://localhost:8000/api/v1/documents" ""
test_service "OpenAPI Schema" "http://localhost:8000/api/openapi.json" "openapi"

echo ""
echo "=========================================="
echo "Test Summary:"
echo ""
echo "Access your services at:"
echo "  🌐 Frontend: http://localhost:3000"
echo "  📊 Backend API: http://localhost:8000/api/docs"
echo "  🔧 Processing Server: http://localhost:8001/docs"
echo ""
echo "To view logs:"
echo "  Backend: tail -f /tmp/backend_test.log"
echo "  Frontend: tail -f /tmp/frontend_test.log"
echo "  Processing: tail -f /tmp/processing_test.log"