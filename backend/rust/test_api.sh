#!/bin/bash

# Comprehensive API Testing Script for Rust Trading API
# Tests all endpoints using curl

BASE_URL="http://127.0.0.1:8080/api"
STRATEGY_ID="550e8400-e29b-41d4-a716-446655440000"
TRADE_ID="550e8400-e29b-41d4-a716-446655440001"
ORDER_ID="550e8400-e29b-41d4-a716-446655440002"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}============================================================${NC}"
    echo -e "${BLUE}🧪 TESTING: $1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo -e "📡 $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer mock_token")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer mock_token" \
            -d "$data")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer mock_token" \
            -d "$data")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer mock_token")
    fi
    
    # Extract status code (last line) and body (everything else)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
        echo -e "✅ Status: $status_code"
    else
        echo -e "❌ Status: $status_code"
    fi
    
    if [ ! -z "$body" ]; then
        echo -e "📄 Response: $(echo "$body" | head -c 200)..."
    fi
}

# Check if API is running
echo -e "${GREEN}🚀 Starting Comprehensive API Testing${NC}"
echo -e "📍 Base URL: $BASE_URL"
echo -e "🕐 Started at: $(date)"

echo -e "\n⏳ Checking if API is running..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ API is not responding. Please start the API first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ API is running!${NC}"

# Test Health Endpoints
print_header "HEALTH & BASIC ENDPOINTS"
test_endpoint "GET" "/health" "" "Health Check"

# Test Strategy Endpoints
print_header "STRATEGY ENDPOINTS"

test_endpoint "GET" "/strategies" "" "Get All Strategies"

test_endpoint "POST" "/strategies" '{
    "name": "Test Strategy",
    "description": "A test trading strategy",
    "type": "custom",
    "risk_level": "medium",
    "market_type": "spot",
    "selected_pairs": ["BTC/USDT", "ETH/USDT"],
    "strategy_config": {
        "indicators": ["RSI", "MACD"],
        "timeframe": "1h",
        "stop_loss": 2.0,
        "take_profit": 4.0
    }
}' "Create New Strategy"

test_endpoint "GET" "/strategies/$STRATEGY_ID" "" "Get Specific Strategy"

test_endpoint "PUT" "/strategies/$STRATEGY_ID" '{
    "name": "Updated Test Strategy",
    "description": "An updated test trading strategy",
    "risk_level": "high",
    "status": "active"
}' "Update Strategy"

test_endpoint "POST" "/strategies/$STRATEGY_ID/activate" "" "Activate Strategy"

test_endpoint "POST" "/strategies/$STRATEGY_ID/deactivate" "" "Deactivate Strategy"

test_endpoint "POST" "/strategies/$STRATEGY_ID/adapt" '{
    "symbol": "BTC/USDT",
    "price": 50000,
    "volume": 1000000,
    "trend": "bullish"
}' "Adapt Strategy"

test_endpoint "GET" "/strategies/$STRATEGY_ID/budget" "" "Get Strategy Budget"

test_endpoint "PUT" "/strategies/$STRATEGY_ID/budget" '{
    "total": 5000.0,
    "max_position_size": 500.0
}' "Update Strategy Budget"

test_endpoint "DELETE" "/strategies/$STRATEGY_ID" "" "Delete Strategy"

# Test Trade Endpoints
print_header "TRADE ENDPOINTS"

test_endpoint "GET" "/trades" "" "Get All Trades"

test_endpoint "GET" "/trades?status=completed" "" "Get Trades with Status Filter"

test_endpoint "POST" "/trades" '{
    "strategy_id": "'$STRATEGY_ID'",
    "symbol": "BTC/USDT",
    "side": "buy",
    "amount": 0.1,
    "entry_price": 50000.0,
    "market_type": "spot",
    "stop_loss": 48000.0,
    "take_profit": 52000.0
}' "Create New Trade"

test_endpoint "GET" "/trades/$TRADE_ID" "" "Get Specific Trade"

test_endpoint "PUT" "/trades/$TRADE_ID" '{
    "strategy_id": "'$STRATEGY_ID'",
    "symbol": "ETH/USDT",
    "side": "sell",
    "amount": 1.0,
    "entry_price": 3200.0
}' "Update Trade"

test_endpoint "POST" "/trades/$TRADE_ID/execute" "" "Execute Trade"

test_endpoint "POST" "/trades/$TRADE_ID/close" "" "Close Trade"

test_endpoint "GET" "/trades/strategy/$STRATEGY_ID" "" "Get Trades by Strategy"

test_endpoint "POST" "/trades/strategy/$STRATEGY_ID/generate" '{
    "symbols": ["BTC/USDT", "ETH/USDT"],
    "market_conditions": "bullish",
    "volatility": "medium"
}' "Generate Trades for Strategy"

test_endpoint "DELETE" "/trades/$TRADE_ID" "" "Delete Trade"

# Test Exchange Endpoints
print_header "EXCHANGE ENDPOINTS"

test_endpoint "GET" "/exchange/balance" "" "Get Balance"

test_endpoint "POST" "/exchange/order" '{
    "symbol": "BTC/USDT",
    "side": "buy",
    "type": "limit",
    "amount": 0.1,
    "price": 49500.0
}' "Create Order"

test_endpoint "GET" "/exchange/orders" "" "Get Open Orders"

test_endpoint "GET" "/exchange/trades" "" "Get Exchange Trades"

test_endpoint "DELETE" "/exchange/order/$ORDER_ID" "" "Cancel Order"

# Summary
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${GREEN}🏁 API Testing Complete!${NC}"
echo -e "🕐 Finished at: $(date)"
echo -e "${BLUE}============================================================${NC}"
