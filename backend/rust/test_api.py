#!/usr/bin/env python3
"""
Comprehensive API Testing Script for Rust Trading API
Tests all endpoints with proper error handling and formatted output.
"""

import requests
import json
import uuid
import time
from datetime import datetime

# API Configuration
BASE_URL = "http://127.0.0.1:8080/api"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Bearer mock_token"  # Mock auth token
}

def print_test_header(title):
    print(f"\n{'='*60}")
    print(f"🧪 TESTING: {title}")
    print(f"{'='*60}")

def print_result(method, endpoint, status_code, response_data, error=None):
    status_emoji = "✅" if 200 <= status_code < 300 else "❌"
    print(f"{status_emoji} {method} {endpoint}")
    print(f"   Status: {status_code}")
    
    if error:
        print(f"   Error: {error}")
    elif response_data:
        if isinstance(response_data, dict) or isinstance(response_data, list):
            print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
        else:
            print(f"   Response: {str(response_data)[:200]}...")
    print()

def make_request(method, endpoint, data=None, params=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=HEADERS, params=params, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=HEADERS, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=HEADERS, timeout=10)
        
        try:
            response_data = response.json()
        except:
            response_data = response.text
            
        print_result(method, endpoint, response.status_code, response_data)
        return response.status_code, response_data
        
    except requests.exceptions.ConnectionError:
        print_result(method, endpoint, 0, None, "Connection refused - API not running")
        return 0, None
    except requests.exceptions.Timeout:
        print_result(method, endpoint, 0, None, "Request timeout")
        return 0, None
    except Exception as e:
        print_result(method, endpoint, 0, None, str(e))
        return 0, None

def test_health_endpoints():
    """Test health and basic endpoints"""
    print_test_header("HEALTH & BASIC ENDPOINTS")
    
    # Health check
    make_request("GET", "/health")

def test_strategy_endpoints():
    """Test all strategy-related endpoints"""
    print_test_header("STRATEGY ENDPOINTS")
    
    # Get all strategies
    status, strategies = make_request("GET", "/strategies")
    
    # Create a new strategy
    new_strategy = {
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
    }
    status, created_strategy = make_request("POST", "/strategies", new_strategy)
    
    # Use a mock strategy ID for further tests
    strategy_id = str(uuid.uuid4())
    
    # Get specific strategy
    make_request("GET", f"/strategies/{strategy_id}")
    
    # Update strategy
    updated_strategy = {
        "name": "Updated Test Strategy",
        "description": "An updated test trading strategy",
        "risk_level": "high",
        "status": "active"
    }
    make_request("PUT", f"/strategies/{strategy_id}", updated_strategy)
    
    # Activate strategy
    make_request("POST", f"/strategies/{strategy_id}/activate")
    
    # Deactivate strategy
    make_request("POST", f"/strategies/{strategy_id}/deactivate")
    
    # Adapt strategy
    market_data = {
        "symbol": "BTC/USDT",
        "price": 50000,
        "volume": 1000000,
        "trend": "bullish"
    }
    make_request("POST", f"/strategies/{strategy_id}/adapt", market_data)
    
    # Get strategy budget
    make_request("GET", f"/strategies/{strategy_id}/budget")
    
    # Update strategy budget
    budget_data = {
        "total": 5000.0,
        "max_position_size": 500.0
    }
    make_request("PUT", f"/strategies/{strategy_id}/budget", budget_data)
    
    # Delete strategy
    make_request("DELETE", f"/strategies/{strategy_id}")

def test_trade_endpoints():
    """Test all trade-related endpoints"""
    print_test_header("TRADE ENDPOINTS")
    
    strategy_id = str(uuid.uuid4())
    
    # Get all trades
    make_request("GET", "/trades")
    
    # Get trades with status filter
    make_request("GET", "/trades", params={"status": "completed"})
    
    # Create a new trade
    new_trade = {
        "strategy_id": strategy_id,
        "symbol": "BTC/USDT",
        "side": "buy",
        "amount": 0.1,
        "entry_price": 50000.0,
        "market_type": "spot",
        "stop_loss": 48000.0,
        "take_profit": 52000.0
    }
    status, created_trade = make_request("POST", "/trades", new_trade)
    
    # Use a mock trade ID for further tests
    trade_id = str(uuid.uuid4())
    
    # Get specific trade
    make_request("GET", f"/trades/{trade_id}")
    
    # Update trade
    updated_trade = {
        "strategy_id": strategy_id,
        "symbol": "ETH/USDT",
        "side": "sell",
        "amount": 1.0,
        "entry_price": 3200.0
    }
    make_request("PUT", f"/trades/{trade_id}", updated_trade)
    
    # Execute trade
    make_request("POST", f"/trades/{trade_id}/execute")
    
    # Close trade
    make_request("POST", f"/trades/{trade_id}/close")
    
    # Get trades by strategy
    make_request("GET", f"/trades/strategy/{strategy_id}")
    
    # Generate trades for strategy
    market_data = {
        "symbols": ["BTC/USDT", "ETH/USDT"],
        "market_conditions": "bullish",
        "volatility": "medium"
    }
    make_request("POST", f"/trades/strategy/{strategy_id}/generate", market_data)
    
    # Delete trade
    make_request("DELETE", f"/trades/{trade_id}")

def test_exchange_endpoints():
    """Test all exchange-related endpoints"""
    print_test_header("EXCHANGE ENDPOINTS")
    
    # Get balance
    make_request("GET", "/exchange/balance")
    
    # Create order
    new_order = {
        "symbol": "BTC/USDT",
        "side": "buy",
        "type": "limit",
        "amount": 0.1,
        "price": 49500.0
    }
    status, created_order = make_request("POST", "/exchange/order", new_order)
    
    # Get open orders
    make_request("GET", "/exchange/orders")
    
    # Get exchange trades
    make_request("GET", "/exchange/trades")
    
    # Cancel order (using mock order ID)
    order_id = str(uuid.uuid4())
    make_request("DELETE", f"/exchange/order/{order_id}")

def main():
    """Run all API tests"""
    print("🚀 Starting Comprehensive API Testing")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Wait a moment for API to be ready
    print("\n⏳ Waiting for API to be ready...")
    time.sleep(2)
    
    # Run all tests
    test_health_endpoints()
    test_strategy_endpoints()
    test_trade_endpoints()
    test_exchange_endpoints()
    
    print(f"\n{'='*60}")
    print("🏁 API Testing Complete!")
    print(f"🕐 Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
